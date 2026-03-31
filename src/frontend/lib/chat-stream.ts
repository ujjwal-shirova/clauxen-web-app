export type StreamEvent =
  | { type: 'start' }
  | { type: 'thinking_start' }
  | { type: 'thinking_delta'; delta: string }
  | { type: 'answer_delta'; delta: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export function createSseParser(onEvent: (event: StreamEvent) => void) {
  let buffer = '';

  return (chunk: string) => {
    buffer += chunk;

    while (true) {
      const boundary = buffer.indexOf('\n\n');
      if (boundary === -1) {
        break;
      }

      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const dataLine = rawEvent
        .split('\n')
        .find((line) => line.startsWith('data: '));

      if (!dataLine) {
        continue;
      }

      try {
        onEvent(JSON.parse(dataLine.slice(6)) as StreamEvent);
      } catch {
        continue;
      }
    }
  };
}
