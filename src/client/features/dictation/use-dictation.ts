"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sessionFetch } from "@/lib/api/client";
import type { DictationLanguageCode } from "@/shared/lib/dictation-languages";
import { MicrophoneCapture } from "@/features/dictation/microphone-capture";
import {
  insertTranscriptAtCaret,
  splitDraftAroundCaret,
  type CaretRange,
} from "@/features/dictation/transcript";
import type {
  ApiEnvelope,
  DictationDevice,
  DictationFinishReason,
  DictationResult,
  DictationStatus,
} from "@/features/dictation/types";

export const DICTATION_MAX_SECONDS = 120;
const SAMPLE_RATE = 16_000;
const MAX_PCM_BYTES = DICTATION_MAX_SECONDS * SAMPLE_RATE * 2;
const DEVICE_STORAGE_KEY = "clauxen_dictation_device";
const LANGUAGE_STORAGE_KEY = "clauxen_dictation_language";

type UseDictationOptions = {
  readDraft: () => string;
  readCaret: () => CaretRange;
  onDraftChange: (value: string, caret: CaretRange) => void;
};

export function formatDictationRemaining(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

async function responseError(response: Response): Promise<Error> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string };
    };
    if (payload.error?.message) return new Error(payload.error.message);
  } catch {
    // Use the status-based message below.
  }
  if (response.status === 401) return new Error("Sign in to use dictation.");
  if (response.status === 413) {
    return new Error("Dictation is limited to 2 minutes per recording.");
  }
  return new Error("Dictation could not be transcribed. Please try again.");
}

export type UseDictationReturn = ReturnType<typeof useDictation>;

export function useDictation({
  readDraft,
  readCaret,
  onDraftChange,
}: UseDictationOptions) {
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState<DictationDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("default");
  const [languageCode, setLanguageCode] = useState<
    "auto" | DictationLanguageCode
  >("auto");
  const statusRef = useRef<DictationStatus>("idle");
  const captureRef = useRef<MicrophoneCapture | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<ArrayBuffer[]>([]);
  const pcmBytesRef = useRef(0);
  const prefixRef = useRef("");
  const suffixRef = useRef("");
  const limitTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const finishRef = useRef<(reason: DictationFinishReason) => void>(() => {});
  const endingRef = useRef<Promise<void> | null>(null);
  const sessionRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const levelPaintRef = useRef(0);
  const applyingRef = useRef(false);

  const updateStatus = useCallback((next: DictationStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const clearTimers = useCallback(() => {
    if (limitTimerRef.current) window.clearTimeout(limitTimerRef.current);
    if (tickTimerRef.current) window.clearInterval(tickTimerRef.current);
    limitTimerRef.current = null;
    tickTimerRef.current = null;
    setRemainingSeconds(null);
  }, []);

  const captureSplit = useCallback(() => {
    const split = splitDraftAroundCaret(readDraft(), readCaret());
    prefixRef.current = split.prefix;
    suffixRef.current = split.suffix;
  }, [readCaret, readDraft]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${index + 1}`,
        }));
      if (!inputs.some((device) => device.deviceId === "default")) {
        inputs.unshift({ deviceId: "default", label: "Default microphone" });
      }
      setDevices(inputs);
    } catch {
      setError("Microphone devices could not be listed.");
    }
  }, []);

  useEffect(() => {
    try {
      const storedDevice = localStorage.getItem(DEVICE_STORAGE_KEY);
      const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (storedDevice) setSelectedDeviceId(storedDevice);
      if (storedLanguage) {
        setLanguageCode(storedLanguage as "auto" | DictationLanguageCode);
      }
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }, []);

  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    try {
      localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
    } catch {
      // Device selection still applies to this session.
    }
  }, []);

  const selectLanguage = useCallback(
    (language: "auto" | DictationLanguageCode) => {
      setLanguageCode(language);
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      } catch {
        // Language selection still applies to this session.
      }
    },
    [],
  );

  const discard = useCallback(() => {
    sessionRef.current += 1;
    clearTimers();
    abortRef.current?.abort();
    abortRef.current = null;
    captureRef.current?.emergencyStop();
    captureRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    chunksRef.current = [];
    pcmBytesRef.current = 0;
    endingRef.current = null;
    setAudioLevel(0);
    updateStatus("idle");
  }, [clearTimers, updateStatus]);

  const finish = useCallback(
    async (reason: DictationFinishReason) => {
      if (statusRef.current !== "listening") return;
      if (endingRef.current) return endingRef.current;

      const work = (async () => {
        clearTimers();
        updateStatus("processing");
        setAudioLevel(0);
        try {
          await captureRef.current?.stop();
          captureRef.current = null;
          streamRef.current = null;
          if (!chunksRef.current.length || pcmBytesRef.current < 320) {
            throw new Error("No speech was recorded. Try dictating again.");
          }

          const audio = new Blob(chunksRef.current, { type: "audio/pcm" });
          const body = new FormData();
          body.append("audio", audio, "dictation.pcm");
          if (languageCode !== "auto") {
            body.append("languageCode", languageCode);
          }
          const controller = new AbortController();
          abortRef.current = controller;
          const response = await sessionFetch("/api/v1/audio/dictation", {
            method: "POST",
            body,
            signal: controller.signal,
          });
          if (!response.ok) throw await responseError(response);
          const { data } =
            (await response.json()) as ApiEnvelope<DictationResult>;
          const transcript = (data.finalText || data.text).trim();
          if (!transcript) {
            throw new Error("No speech was detected. Try dictating again.");
          }
          const next = insertTranscriptAtCaret(
            prefixRef.current,
            transcript,
            suffixRef.current,
          );
          applyingRef.current = true;
          onDraftChange(next.text, next.caret);
          queueMicrotask(() => {
            applyingRef.current = false;
          });
          if (reason === "time-limit") {
            setNotice("Dictation stopped after the 2-minute limit.");
          } else if (reason === "track-ended") {
            setNotice(
              "The microphone disconnected. Your recording was transcribed.",
            );
          }
        } catch (finishError) {
          if (
            finishError instanceof DOMException &&
            finishError.name === "AbortError"
          ) {
            return;
          }
          setError(
            finishError instanceof Error
              ? finishError.message
              : "Dictation could not be completed.",
          );
        } finally {
          abortRef.current = null;
          chunksRef.current = [];
          pcmBytesRef.current = 0;
          endingRef.current = null;
          updateStatus("idle");
        }
      })();
      endingRef.current = work;
      return work;
    },
    [clearTimers, languageCode, onDraftChange, updateStatus],
  );

  useEffect(() => {
    finishRef.current = (reason) => {
      void finish(reason);
    };
  }, [finish]);

  const start = useCallback(async () => {
    if (statusRef.current !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support microphone dictation.");
      return;
    }

    const session = ++sessionRef.current;
    setError(null);
    setNotice(null);
    chunksRef.current = [];
    pcmBytesRef.current = 0;
    updateStatus("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId:
            selectedDeviceId && selectedDeviceId !== "default"
              ? { exact: selectedDeviceId }
              : undefined,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const capture = new MicrophoneCapture(
        stream,
        (audio) => {
          const remaining = MAX_PCM_BYTES - pcmBytesRef.current;
          if (remaining <= 0) return;
          const chunk =
            audio.byteLength > remaining ? audio.slice(0, remaining) : audio;
          chunksRef.current.push(chunk);
          pcmBytesRef.current += chunk.byteLength;
          if (pcmBytesRef.current >= MAX_PCM_BYTES) {
            queueMicrotask(() => finishRef.current("time-limit"));
          }
        },
        (level) => {
          const now = performance.now();
          if (now - levelPaintRef.current < 80) return;
          levelPaintRef.current = now;
          setAudioLevel(level);
        },
      );
      captureRef.current = capture;
      for (const track of stream.getAudioTracks()) {
        track.onended = () => finishRef.current("track-ended");
      }
      await capture.start();
      if (sessionRef.current !== session) {
        capture.emergencyStop();
        return;
      }
      captureSplit();
      updateStatus("listening");
      void refreshDevices();

      const deadline = Date.now() + DICTATION_MAX_SECONDS * 1000;
      setRemainingSeconds(DICTATION_MAX_SECONDS);
      tickTimerRef.current = window.setInterval(() => {
        setRemainingSeconds(
          Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
        );
      }, 1000);
      limitTimerRef.current = window.setTimeout(() => {
        finishRef.current("time-limit");
      }, DICTATION_MAX_SECONDS * 1000);
    } catch (startError) {
      if (sessionRef.current !== session) return;
      captureRef.current?.emergencyStop();
      captureRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      clearTimers();
      updateStatus("idle");
      setError(
        startError instanceof DOMException &&
          startError.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access and try again."
          : startError instanceof DOMException &&
              startError.name === "NotFoundError"
            ? "No microphone was found. Choose another input device."
            : startError instanceof Error
              ? startError.message
              : "Dictation could not start.",
      );
    }
  }, [
    captureSplit,
    clearTimers,
    refreshDevices,
    selectedDeviceId,
    updateStatus,
  ]);

  const cancel = useCallback(async () => {
    if (statusRef.current === "processing" || statusRef.current === "idle")
      return;
    discard();
  }, [discard]);

  const rebaseToCaret = useCallback(
    (caret: CaretRange) => {
      if (
        statusRef.current !== "listening" &&
        statusRef.current !== "processing"
      ) {
        return;
      }
      if (applyingRef.current) return;
      const split = splitDraftAroundCaret(readDraft(), caret);
      prefixRef.current = split.prefix;
      suffixRef.current = split.suffix;
    },
    [readDraft],
  );

  useEffect(() => {
    const onPageHide = () => discard();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      discard();
    };
  }, [discard]);

  return {
    status,
    error,
    notice,
    remainingSeconds,
    audioLevel,
    devices,
    selectedDeviceId,
    languageCode,
    isActive: status !== "idle",
    isListening: status === "listening",
    applyingRef,
    start,
    submit: () => finish("submitted"),
    cancel,
    rebaseToCaret,
    refreshDevices,
    selectDevice,
    selectLanguage,
  };
}
