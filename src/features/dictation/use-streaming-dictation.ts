"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AssemblyAiStreamingConnection } from "@/features/dictation/assemblyai-stream";
import {
  getPreferredRecordingMimeType,
  MicrophoneCapture,
} from "@/features/dictation/microphone-capture";
import { DictationRecordingUploader } from "@/features/dictation/recording-uploader";
import {
  applyAssemblyTurn,
  EMPTY_STREAMING_TRANSCRIPT,
  joinDraftAndTranscript,
  transcriptText,
  type StreamingTranscriptState,
} from "@/features/dictation/transcript";
import type {
  ApiEnvelope,
  DictationFinishReason,
  DictationSessionResponse,
  DictationStatus,
} from "@/features/dictation/types";

type UseStreamingDictationOptions = {
  readDraft: () => string;
  onDraftChange: (value: string) => void;
};

export function useStreamingDictation({
  readDraft,
  onDraftChange,
}: UseStreamingDictationOptions) {
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [displayText, setDisplayText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<DictationStatus>("idle");
  const baseDraftRef = useRef("");
  const transcriptRef = useRef<StreamingTranscriptState>(
    EMPTY_STREAMING_TRANSCRIPT,
  );
  const connectionRef = useRef<AssemblyAiStreamingConnection | null>(null);
  const captureRef = useRef<MicrophoneCapture | null>(null);
  const uploaderRef = useRef<DictationRecordingUploader | null>(null);
  const endingRef = useRef<Promise<void> | null>(null);

  const updateStatus = useCallback((next: DictationStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const currentText = useCallback(() => {
    return joinDraftAndTranscript(
      baseDraftRef.current,
      transcriptText(transcriptRef.current),
    );
  }, []);

  const releaseRefs = useCallback(() => {
    connectionRef.current = null;
    captureRef.current = null;
    uploaderRef.current = null;
    transcriptRef.current = EMPTY_STREAMING_TRANSCRIPT;
    endingRef.current = null;
  }, []);

  const finish = useCallback(
    async (reason: DictationFinishReason) => {
      if (statusRef.current === "idle") return;
      if (endingRef.current) return endingRef.current;

      const work = (async () => {
        updateStatus("stopping");
        const capture = captureRef.current;
        const connection = connectionRef.current;
        const uploader = uploaderRef.current;

        try {
          await capture?.stop();
          await connection?.finish();
          const text = currentText();
          await uploader?.finalize(reason, text);
          if (reason === "cancelled") {
            onDraftChange(baseDraftRef.current);
            setDisplayText(baseDraftRef.current);
          } else {
            onDraftChange(text);
            setDisplayText(text);
          }
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
    [currentText, onDraftChange, releaseRefs, updateStatus],
  );

  const finishInBackground = useCallback(() => {
    if (statusRef.current === "idle") return;
    const text = currentText();
    captureRef.current?.emergencyStop();
    void connectionRef.current?.finish();
    uploaderRef.current?.finalizeInBackground("page-hidden", text);
    releaseRefs();
    statusRef.current = "idle";
  }, [currentText, releaseRefs]);

  const start = useCallback(async () => {
    if (statusRef.current !== "idle") return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("This browser does not support microphone dictation.");
      return;
    }

    setError(null);
    baseDraftRef.current = readDraft();
    transcriptRef.current = EMPTY_STREAMING_TRANSCRIPT;
    setDisplayText(baseDraftRef.current);
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
      if (!response.ok) throw new Error("Dictation could not start.");
      const { data } =
        (await response.json()) as ApiEnvelope<DictationSessionResponse>;

      const uploader = new DictationRecordingUploader(data.sessionId);
      uploaderRef.current = uploader;
      const connection = new AssemblyAiStreamingConnection(
        data,
        (turn) => {
          transcriptRef.current = applyAssemblyTurn(
            transcriptRef.current,
            turn,
          );
          const text = currentText();
          setDisplayText(text);
          onDraftChange(text);
        },
        () => setError("The live transcription stream reported an error."),
      );
      connectionRef.current = connection;
      await connection.connect();

      const capture = new MicrophoneCapture(
        stream,
        (audio) => connection.sendAudio(audio),
        (chunk) => uploader.enqueue(chunk),
      );
      captureRef.current = capture;
      for (const track of stream.getAudioTracks()) {
        track.onended = () => void finish("track-ended");
      }
      await capture.start();
      updateStatus("listening");
    } catch (startError) {
      stream?.getTracks().forEach((track) => track.stop());
      connectionRef.current?.close();
      uploaderRef.current?.finalizeInBackground("error", currentText());
      releaseRefs();
      onDraftChange(baseDraftRef.current);
      setDisplayText(baseDraftRef.current);
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
    currentText,
    finish,
    onDraftChange,
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
    displayText,
    error,
    isActive: status !== "idle",
    start,
    submit: () => finish("submitted"),
    cancel: () => finish("cancelled"),
  };
}
