"use client";

import { useEffect, useRef } from "react";

function motionReduced() {
  return (
    document.documentElement.getAttribute("data-reduce-motion") === "1" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function inkChannels() {
  return document.documentElement.classList.contains("dark")
    ? "244, 244, 245"
    : "20, 21, 26";
}

/**
 * Quiet numeric field across the top of the sign-in panel.
 * Reads as an instrument, not a loader — digits drift and fade into the form.
 */
export function AuthNumericField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let frame = 0;
    let stopped = false;
    const reduced = motionReduced();

    type Column = {
      x: number;
      speed: number;
      phase: number;
      size: number;
      weight: number;
    };

    let columns: Column[] = [];
    let width = 0;
    let height = 0;

    const layout = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const gap = 52;
      const count = Math.max(8, Math.ceil(width / gap) + 1);
      columns = Array.from({ length: count }, (_, i) => ({
        x: i * gap + ((i * 17) % 11) - 8,
        speed: 9 + (i % 5) * 2.2,
        phase: (i * 53) % 160,
        size: i % 6 === 0 ? 15 : 12,
        weight: i % 4 === 0 ? 0.2 : 0.11,
      }));
    };

    const paint = (time: number) => {
      const ink = inkChannels();
      ctx.clearRect(0, 0, width, height);
      ctx.textBaseline = "alphabetic";

      const readout =
        "0.184    012    4.90    208    0.073    441    19    8.02    903    12.6    0.41    776    033    1.908    550    ";
      ctx.font =
        "500 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      const readoutWidth = Math.max(1, ctx.measureText(readout).width);
      const shift = reduced ? 24 : (time / 70) % readoutWidth;
      const yRead = Math.min(48, height * 0.18);
      ctx.fillStyle = `rgba(${ink}, 0.2)`;
      for (let x = -shift; x < width + readoutWidth; x += readoutWidth) {
        ctx.fillText(readout, x, yRead);
      }

      const counter =
        "908    0.16    44    2.771    015    6.4    330    0.092    18    1.204    ";
      ctx.font =
        "500 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      const counterWidth = Math.max(1, ctx.measureText(counter).width);
      const shiftBack = reduced ? 0 : (time / 110) % counterWidth;
      ctx.fillStyle = `rgba(${ink}, 0.1)`;
      const yCounter = yRead + 28;
      for (
        let x = shiftBack - counterWidth;
        x < width + counterWidth;
        x += counterWidth
      ) {
        ctx.fillText(counter, x, yCounter);
      }

      ctx.textBaseline = "top";
      const span = 26;
      for (const col of columns) {
        const edge = Math.min(col.x, width - col.x) / 72;
        const edgeFade = Math.max(0, Math.min(1, edge));
        ctx.font = `500 ${col.size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
        const travel = reduced
          ? col.phase
          : (time / 1000) * col.speed + col.phase;
        const start = -((travel % span) + span);
        for (let y = start; y < height + span; y += span) {
          const focus = 1 - Math.min(1, Math.abs(y - height * 0.34) / (height * 0.7));
          const alpha = col.weight * edgeFade * (0.2 + focus);
          if (alpha < 0.025) continue;
          const n = Math.abs(Math.floor(col.x * 3 + y * 1.7 + col.phase)) % 1000;
          ctx.fillStyle = `rgba(${ink}, ${alpha.toFixed(3)})`;
          ctx.fillText(String(n).padStart(3, "0"), col.x, y);
        }
      }
    };

    const loop = (time: number) => {
      if (stopped) return;
      paint(time);
      if (!reduced) frame = window.requestAnimationFrame(loop);
    };

    layout();
    frame = window.requestAnimationFrame(loop);

    const onResize = () => {
      layout();
      if (reduced) paint(performance.now());
    };
    window.addEventListener("resize", onResize);

    const observer = new MutationObserver(() => {
      paint(performance.now());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-reduce-motion"],
    });

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="auth-numeric-field" aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}
