import type { AssemblyTurnEvent } from "@/features/dictation/types";

type StreamConfig = {
  token: string;
  streamingHost: string;
  sampleRate: number;
  speechModel: string;
  mode: string;
};

type ServerEvent = Record<string, unknown> & { type?: string; error?: string };

function isTurnEvent(
  message: ServerEvent,
): message is ServerEvent & AssemblyTurnEvent {
  return (
    message.type === "Turn" &&
    typeof message.turn_order === "number" &&
    typeof message.end_of_turn === "boolean" &&
    typeof message.transcript === "string"
  );
}

export class AssemblyAiStreamingConnection {
  private socket: WebSocket | null = null;
  private terminated = false;
  private terminationResolve: (() => void) | null = null;
  private readonly termination = new Promise<void>((resolve) => {
    this.terminationResolve = resolve;
  });

  constructor(
    private readonly config: StreamConfig,
    private readonly onTurn: (turn: AssemblyTurnEvent) => void,
    private readonly onError: (message: string) => void,
  ) {}

  connect(): Promise<void> {
    const url = new URL(`wss://${this.config.streamingHost}/v3/ws`);
    url.searchParams.set("token", this.config.token);
    url.searchParams.set("sample_rate", String(this.config.sampleRate));
    url.searchParams.set("speech_model", this.config.speechModel);
    url.searchParams.set("mode", this.config.mode);

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.binaryType = "arraybuffer";
      this.socket = socket;
      socket.onopen = () => resolve();
      socket.onerror = () =>
        reject(new Error("Could not connect to dictation."));
      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        let message: ServerEvent;
        try {
          message = JSON.parse(event.data) as ServerEvent;
        } catch {
          return;
        }
        if (isTurnEvent(message)) this.onTurn(message);
        if (message.type === "Termination") {
          this.terminated = true;
          this.terminationResolve?.();
        }
        if (message.error) this.onError(message.error);
      };
      socket.onclose = () => {
        if (!this.terminated) this.terminationResolve?.();
      };
    });
  }

  sendAudio(audio: ArrayBuffer) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(audio);
  }

  async finish() {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: "Terminate" }));
    await Promise.race([
      this.termination,
      new Promise<void>((resolve) => window.setTimeout(resolve, 2_000)),
    ]);
    this.close();
  }

  close() {
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      this.socket.close(1000, "Client finished");
    }
    this.socket = null;
  }
}
