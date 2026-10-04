"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AssemblyAiStreamingConnection } from "@/features/dictation/assemblyai-stream";
import {
  getPreferredRecordingMimeType,
  MicrophoneCapture,
} from "@/features/dictation/microphone-capture";
import {
  applyAssemblyTurn,
  EMPTY_STREAMING_TRANSCRIPT,
  insertTranscriptAtCaret,
  splitDraftAroundCaret,
  transcriptText,
  type CaretRange,
  type StreamingTranscriptState,
} from "@/features/dictation/transcript";
import type {
  ApiEnvelope,
  DictationFinishReason,
  DictationSessionResponse,
  DictationStatus,
} from "@/features/dictation/types";

/** Client-side mirrors of the server caps (used when the server omits them). */
const DEFAULT_MAX_SESSION_SECONDS = 4 * 60;
const DEFAULT_INACTIVITY_TIMEOUT_SECONDS = 30;

const AUTO_STOP_NOTICES: Partial<Record<DictationFinishReason, string>> = {
  "time-limit": "Dictation stopped after the 4-minute limit. Tap the mic to continue.",
  silence: "Dictation stopped — no speech detected.",
  "remote-closed": "Dictation session ended. Tap the mic to continue.",
};

/** `m:ss` label for the remaining-session countdown. */
export function formatDictationRemaining(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

type UseStreamingDictationOptions = {
  readDraft: () => string;
  readCaret: () => CaretRange;
  onDraftChange: (value: string, caret: CaretRange) => void;
};

export function useStreamingDictation({
  readDraft,
  readCaret,
  onDraftChange,
}: UseStreamingDictationOptions) {
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    null,
  );
  const limitTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const silenceMsRef = useRef(DEFAULT_INACTIVITY_TIMEOUT_SECONDS * 1000);
  const finishRef = useRef<(reason: DictationFinishReason) => void>(() => {});
  const statusRef = useRef<DictationStatus>("idle");
  const originDraftRef = useRef("");
  const prefixRef = useRef("");
  const suffixRef = useRef("");
  const transcriptRef = useRef<StreamingTranscriptState>(
    EMPTY_STREAMING_TRANSCRIPT,
  );
  const connectionRef = useRef<AssemblyAiStreamingConnection | null>(null);
  const captureRef = useRef<MicrophoneCapture | null>(null);
  const endingRef = useRef<Promise<void> | null>(null);
  const applyingRef = useRef(false);

  const updateStatus = useCallback((next: DictationStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const captureSplit = useCallback(() => {
    const draft = readDraft();
    const split = splitDraftAroundCaret(draft, readCaret());
    prefixRef.current = split.prefix;
    suffixRef.current = split.suffix;
  }, [readCaret, readDraft]);

  const currentInsertion = useCallback(() => {
    return insertTranscriptAtCaret(
      prefixRef.current,
      transcriptText(transcriptRef.current),
      suffixRef.current,
    );
  }, []);

  const publish = useCallback(() => {
    const next = currentInsertion();
    applyingRef.current = true;
    onDraftChange(next.text, next.caret);
    queueMicrotask(() => {
      applyingRef.current = false;
    });
  }, [currentInsertion, onDraftChange]);

  const clearWatchdogs = useCallback(() => {
    if (limitTimerRef.current) window.clearTimeout(limitTimerRef.current);
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    if (tickTimerRef.current) window.clearInterval(tickTimerRef.current);
    limitTimerRef.current = null;
    silenceTimerRef.current = null;
    tickTimerRef.current = null;
    setRemainingSeconds(null);
  }, []);

  /** Restart the silence watchdog — called whenever speech is transcribed. */
  const armSilenceWatchdog = useCallback(() => {
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = window.setTimeout(() => {
      finishRef.current("silence");
    }, silenceMsRef.current);
  }, []);

  const releaseRefs = useCallback(() => {
    clearWatchdogs();
    connectionRef.current = null;
    captureRef.current = null;
    transcriptRef.current = EMPTY_STREAMING_TRANSCRIPT;
    endingRef.current = null;
    prefixRef.current = "";
    suffixRef.current = "";
  }, [clearWatchdogs]);

  const finish = useCallback(
    async (reason: DictationFinishReason) => {
      if (statusRef.current === "idle") return;
      if (endingRef.current) return endingRef.current;

      const work = (async () => {
        clearWatchdogs();
        updateStatus("stopping");
        const capture = captureRef.current;
        const connection = connectionRef.current;

        try {
          await capture?.stop();
          await connection?.finish();
          // Live transcription only — never upload/persist microphone audio.
          if (reason === "cancelled") {
            const origin = originDraftRef.current;
            onDraftChange(origin, {
              start: origin.length,
              end: origin.length,
            });
          } else {
            publish();
          }
          const autoNotice = AUTO_STOP_NOTICES[reason];
          if (autoNotice) setNotice(autoNotice);
        } catch (finishError) {
          setError(
            finishError instanceof Error
              ? finishError.message
              : "Dictation could not be completed.",
          );
        } finally {
          connection?.close();
          releaseRefs();
          updateStatus("idle");
        }
      })();
      endingRef.current = work;
      return work;
    },
    [clearWatchdogs, onDraftChange, publish, releaseRefs, updateStatus],
  );
  useEffect(() => {
    finishRef.current = (reason) => {
      if (statusRef.current !== "listening") return;
      void finish(reason);
    };
  }, [finish]);

  const finishInBackground = useCallback(() => {
    if (statusRef.current === "idle") return;
    const next = currentInsertion();
    captureRef.current?.emergencyStop();
    void connectionRef.current?.finish();
    onDraftChange(next.text, next.caret);
    releaseRefs();
    statusRef.current = "idle";
  }, [currentInsertion, onDraftChange, releaseRefs]);

  const rebaseToCaret = useCallback(
    (caret: CaretRange) => {
      if (statusRef.current !== "listening") return;
      if (applyingRef.current) return;
      const split = splitDraftAroundCaret(readDraft(), caret);
      prefixRef.current = split.prefix;
      suffixRef.current = split.suffix;
      transcriptRef.current = EMPTY_STREAMING_TRANSCRIPT;
    },
    [readDraft],
  );

  const start = useCallback(async () => {
    if (statusRef.current !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support microphone dictation.");
      return;
    }

    setError(null);
    setNotice(null);
    originDraftRef.current = readDraft();
    transcriptRef.current = EMPTY_STREAMING_TRANSCRIPT;
    captureSplit();
    updateStatus("connecting");

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const response = await fetch("/api/v1/audio/dictation/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType: getPreferredRecordingMimeType() }),
      });
      if (!response.ok) {
        let message = "Dictation could not start.";
        try {
          const payload = (await response.json()) as {
            error?: { message?: string; code?: string };
          };
          if (payload.error?.message?.trim()) {
            message = payload.error.message.trim();
          } else if (response.status === 401) {
            message = "Sign in to use dictation.";
          }
        } catch {
          /* keep generic */
        }
        throw new Error(message);
      }
      const { data } =
        (await response.json()) as ApiEnvelope<DictationSessionResponse>;
      if (!data?.token || !data?.sessionId) {
        throw new Error("Dictation session was incomplete.");
      }

      const maxSessionSeconds =
        data.maxSessionSeconds ?? DEFAULT_MAX_SESSION_SECONDS;
      silenceMsRef.current =
        (data.inactivityTimeoutSeconds ?? DEFAULT_INACTIVITY_TIMEOUT_SECONDS) *
        1000;

      const connection = new AssemblyAiStreamingConnection(
        data,
        (turn) => {
          const before = transcriptText(transcriptRef.current);
          transcriptRef.current = applyAssemblyTurn(
            transcriptRef.current,
            turn,
          );
          if (
            statusRef.current === "listening" &&
            turn.transcript.trim() &&
            transcriptText(transcriptRef.current) !== before
          ) {
            armSilenceWatchdog();
          }
          publish();
        },
        () => setError("The live transcription stream reported an error."),
        () => finishRef.current("remote-closed"),
      );
      connectionRef.current = connection;
      await connection.connect();

      // PCM → AssemblyAI only. No MediaRecorder / R2 chunk uploads.
      const capture = new MicrophoneCapture(stream, (audio) =>
        connection.sendAudio(audio),
      );
      captureRef.current = capture;
      for (const track of stream.getAudioTracks()) {
        track.onended = () => void finish("track-ended");
      }
      await capture.start();
      // Re-read in case the user typed or moved the caret while connecting.
      originDraftRef.current = readDraft();
      captureSplit();
      updateStatus("listening");

      // Cost guards: hard session cap + silence auto-stop. The server token
      // enforces the same cap, so this only makes the stop graceful.
      const deadline = Date.now() + maxSessionSeconds * 1000;
      setRemainingSeconds(maxSessionSeconds);
      tickTimerRef.current = window.setInterval(() => {
        setRemainingSeconds(
          Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
        );
      }, 1000);
      limitTimerRef.current = window.setTimeout(() => {
        finishRef.current("time-limit");
      }, maxSessionSeconds * 1000);
      armSilenceWatchdog();
    } catch (startError) {
      stream?.getTracks().forEach((track) => track.stop());
      connectionRef.current?.close();
      const origin = originDraftRef.current;
      onDraftChange(origin, { start: origin.length, end: origin.length });
      releaseRefs();
      setError(
        startError instanceof DOMException &&
          startError.name === "NotAllowedError"
          ? "Microphone permission was denied."
          : startError instanceof Error
            ? startError.message
            : "Dictation could not start.",
      );
      updateStatus("idle");
    }
  }, [
    armSilenceWatchdog,
    captureSplit,
    finish,
    onDraftChange,
    publish,
    readDraft,
    releaseRefs,
    updateStatus,
  ]);

  useEffect(() => {
    const onPageHide = () => finishInBackground();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      finishInBackground();
    };
  }, [finishInBackground]);

  return {
    status,
    error,
    /** Informational message after an automatic stop (limit / silence). */
    notice,
    /** Seconds left before the session cap while listening, else null. */
    remainingSeconds,
    isActive: status !== "idle",
    isConnecting: status === "connecting",
    isListening: status === "listening",
    applyingRef,
    start,
    submit: () => finish("submitted"),
    cancel: () => finish("cancelled"),
    rebaseToCaret,
  };
}
