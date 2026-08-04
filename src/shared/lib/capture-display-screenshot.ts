export type ScreenshotCaptureErrorCode =
  | "unsupported"
  | "denied"
  | "cancelled"
  | "failed";

export class ScreenshotCaptureError extends Error {
  readonly code: ScreenshotCaptureErrorCode;

  constructor(message: string, code: ScreenshotCaptureErrorCode) {
    super(message);
    this.name = "ScreenshotCaptureError";
    this.code = code;
  }
}

export type CapturedScreenshot = {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  fileName: string;
};

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new ScreenshotCaptureError("Could not read screen stream.", "failed"));
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    };

    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

/**
 * Captures a single frame via the browser Screen Capture API.
 * The user picks a tab, window, or screen in the native browser picker.
 */
export async function captureDisplayScreenshot(): Promise<CapturedScreenshot> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getDisplayMedia
  ) {
    throw new ScreenshotCaptureError(
      "Screen capture is not supported in this browser.",
      "unsupported",
    );
  }

  let stream: MediaStream | null = null;

  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "browser",
      } as MediaTrackConstraints,
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      monitorTypeSurfaces: "include",
    } as DisplayMediaStreamOptions);

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    await video.play();
    await waitForVideoFrame(video);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      throw new ScreenshotCaptureError(
        "Could not read screenshot dimensions.",
        "failed",
      );
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new ScreenshotCaptureError("Could not encode screenshot.", "failed");
    }

    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("Screenshot encoding failed."));
        },
        "image/png",
        1,
      );
    });

    const dataUrl = canvas.toDataURL("image/png");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");

    return {
      blob,
      dataUrl,
      width,
      height,
      fileName: `screenshot-${stamp}.png`,
    };
  } catch (error) {
    if (error instanceof ScreenshotCaptureError) throw error;

    const domError = error as DOMException;
    if (domError?.name === "NotAllowedError") {
      throw new ScreenshotCaptureError(
        "Screen capture permission was denied.",
        "denied",
      );
    }
    if (domError?.name === "AbortError") {
      throw new ScreenshotCaptureError(
        "Screen capture was cancelled.",
        "cancelled",
      );
    }

    throw new ScreenshotCaptureError("Could not capture screenshot.", "failed");
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
}
