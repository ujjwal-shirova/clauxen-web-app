const TARGET_SAMPLE_RATE = 16_000;

class StreamingLinearResampler {
  private pending = new Float32Array(0);
  private position = 0;

  constructor(
    private readonly inputRate: number,
    private readonly outputRate: number,
  ) {}

  push(chunk: Float32Array): Int16Array {
    const input = new Float32Array(this.pending.length + chunk.length);
    input.set(this.pending);
    input.set(chunk, this.pending.length);
    const ratio = this.inputRate / this.outputRate;
    const output: number[] = [];

    while (this.position < input.length - 1) {
      const left = Math.floor(this.position);
      const fraction = this.position - left;
      const sample =
        (input[left] ?? 0) * (1 - fraction) + (input[left + 1] ?? 0) * fraction;
      output.push(Math.max(-1, Math.min(1, sample)));
      this.position += ratio;
    }

    const consumed = Math.floor(this.position);
    this.pending = input.slice(Math.min(consumed, input.length - 1));
    this.position -= consumed;

    const pcm = new Int16Array(output.length);
    for (let index = 0; index < output.length; index += 1) {
      const sample = output[index] ?? 0;
      pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return pcm;
  }
}

export class MicrophoneCapture {
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(
    private readonly stream: MediaStream,
    private readonly onPcm: (audio: ArrayBuffer) => void,
    private readonly onLevel: (level: number) => void,
  ) {}

  async start() {
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio is not supported.");

    this.audioContext = new AudioContextClass();
    await this.audioContext.resume();
    const resampler = new StreamingLinearResampler(
      this.audioContext.sampleRate,
      TARGET_SAMPLE_RATE,
    );
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    const silentGain = this.audioContext.createGain();
    silentGain.gain.value = 0;
    this.processor.onaudioprocess = (event) => {
      const samples = event.inputBuffer.getChannelData(0);
      let squares = 0;
      for (let index = 0; index < samples.length; index += 1) {
        const sample = samples[index] ?? 0;
        squares += sample * sample;
      }
      const rms = Math.sqrt(squares / Math.max(1, samples.length));
      this.onLevel(Math.min(1, rms * 4.5));

      const pcm = resampler.push(samples);
      if (pcm.byteLength > 0) {
        this.onPcm(
          pcm.buffer.slice(
            pcm.byteOffset,
            pcm.byteOffset + pcm.byteLength,
          ) as ArrayBuffer,
        );
      }
    };
    this.source.connect(this.processor);
    this.processor.connect(silentGain);
    silentGain.connect(this.audioContext.destination);
  }

  async stop() {
    this.stopAudioGraph();
    this.stopTracks();
  }

  emergencyStop() {
    this.stopAudioGraph();
    this.stopTracks();
  }

  private stopAudioGraph() {
    if (this.processor) this.processor.onaudioprocess = null;
    this.processor?.disconnect();
    this.source?.disconnect();
    this.processor = null;
    this.source = null;
    void this.audioContext?.close().catch(() => undefined);
    this.audioContext = null;
  }

  private stopTracks() {
    this.stream.getTracks().forEach((track) => track.stop());
  }
}
