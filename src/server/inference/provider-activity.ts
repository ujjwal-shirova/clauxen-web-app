/** Bound silent provider waits while permitting long, actively streaming turns. */
export function createProviderActivityGuard(
  signal?: AbortSignal,
  idleMs = 45_000,
) {
  const idle = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const touch = () => {
    clearTimeout(timer);
    timer = setTimeout(
      () =>
        idle.abort(
          new Error(
            "The model provider did not send output within the response deadline.",
          ),
        ),
      idleMs,
    );
    timer.unref?.();
  };
  touch();
  return {
    signal: signal ? AbortSignal.any([signal, idle.signal]) : idle.signal,
    touch,
    get timedOut() {
      return idle.signal.aborted;
    },
    dispose() {
      clearTimeout(timer);
    },
  };
}
