"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VIEWPORT = 320;
const OUTPUT = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

type AvatarCropDialogProps = {
  imageSrc: string;
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSave: (file: File) => void;
};

function clampOffset(
  x: number,
  y: number,
  scale: number,
  naturalWidth: number,
  naturalHeight: number,
) {
  const drawnW = naturalWidth * scale;
  const drawnH = naturalHeight * scale;
  const minX = Math.min(0, VIEWPORT - drawnW);
  const minY = Math.min(0, VIEWPORT - drawnH);
  return {
    x: Math.min(0, Math.max(minX, x)),
    y: Math.min(0, Math.max(minY, y)),
  };
}

export function AvatarCropDialog({
  imageSrc,
  open,
  busy = false,
  error,
  onCancel,
  onSave,
}: AvatarCropDialogProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const scale = baseScale * zoom;

  const resetForImage = useCallback((img: HTMLImageElement) => {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return;
    const cover = Math.max(VIEWPORT / width, VIEWPORT / height);
    setNatural({ width, height });
    setBaseScale(cover);
    setZoom(1);
    setOffset({
      x: (VIEWPORT - width * cover) / 2,
      y: (VIEWPORT - height * cover) / 2,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const img = new Image();
    img.onload = () => resetForImage(img);
    img.src = imageSrc;
  }, [imageSrc, open, resetForImage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [busy, onCancel, open]);

  if (!open) return null;

  const applyZoom = (nextZoom: number, originX = VIEWPORT / 2, originY = VIEWPORT / 2) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    const nextScale = baseScale * clamped;
    const prevScale = scale;
    if (prevScale <= 0) {
      setZoom(clamped);
      return;
    }
    const imageX = (originX - offset.x) / prevScale;
    const imageY = (originY - offset.y) / prevScale;
    const nextOffset = clampOffset(
      originX - imageX * nextScale,
      originY - imageY * nextScale,
      nextScale,
      natural.width,
      natural.height,
    );
    setZoom(clamped);
    setOffset(nextOffset);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = clampOffset(
      drag.originX + (event.clientX - drag.startX),
      drag.originY + (event.clientY - drag.startY),
      scale,
      natural.width,
      natural.height,
    );
    setOffset(next);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (busy || !natural.width) return;
    const rect = event.currentTarget.getBoundingClientRect();
    applyZoom(
      zoom * (event.deltaY > 0 ? 0.92 : 1.08),
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
  };

  const handleSave = () => {
    const img = imageRef.current;
    if (!img || !natural.width || busy) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    const sourceSize = VIEWPORT / scale;
    ctx.drawImage(
      img,
      -offset.x / scale,
      -offset.y / scale,
      sourceSize,
      sourceSize,
      0,
      0,
      OUTPUT,
      OUTPUT,
    );
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onSave(
          new File([blob], "avatar.jpg", {
            type: "image/jpeg",
            lastModified: Date.now(),
          }),
        );
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div
      data-nested-settings-dialog=""
      className="fixed inset-0 z-[230] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Dismiss crop"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        disabled={busy}
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        className="settings-theme relative z-[1] w-[min(calc(100vw-2rem),28rem)] overflow-hidden rounded-[22px] border border-[var(--settings-modal-border)] bg-[var(--settings-card-bg)] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
      >
        <h2
          id="avatar-crop-title"
          className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--settings-fg)]"
        >
          Crop profile photo
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-[var(--settings-fg-muted)]">
          Drag to reposition. Scroll or use the slider to zoom.
        </p>

        <div className="mt-4 flex flex-col items-center gap-3">
          <div
            className="relative overflow-hidden rounded-[18px] bg-zinc-950 touch-none"
            style={{ width: VIEWPORT, height: VIEWPORT, maxWidth: "100%" }}
            ref={viewportRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onWheel={onWheel}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt=""
              draggable={false}
              className="absolute left-0 top-0 max-w-none select-none"
              style={{
                width: natural.width ? natural.width * scale : "auto",
                height: natural.height ? natural.height * scale : "auto",
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(255,255,255,0.32) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255,255,255,0.32) 1px, transparent 1px)
                `,
                backgroundSize: `${VIEWPORT / 3}px ${VIEWPORT / 3}px`,
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[18px]"
              style={{
                background:
                  "radial-gradient(circle at center, transparent 46%, rgba(0,0,0,0.42) 46.5%)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.16)",
              }}
            />
          </div>

          <label className="flex w-full max-w-[320px] items-center gap-3 text-[12px] text-[var(--settings-fg-muted)]">
            <span className="w-10 shrink-0">Zoom</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              disabled={busy}
              onChange={(event) => applyZoom(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer accent-[hsl(var(--brand))]"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-3 text-[13px] text-[var(--settings-danger)]">{error}</p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="settings-btn settings-btn--muted"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="settings-btn settings-btn--primary min-w-[4.5rem]"
            disabled={busy || !natural.width}
            onClick={handleSave}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
