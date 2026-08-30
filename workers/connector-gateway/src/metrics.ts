type MetricInput = {
  kind: string;
  route?: string;
  status?: string;
  connectorKey?: string | null;
  userId?: string | null;
  durationMs?: number;
  value?: number;
};

export function recordMetric(input: MetricInput): void {
  const httpStatus = Number(input.status);
  if (
    input.kind === "http_request" &&
    Number.isFinite(httpStatus) &&
    httpStatus < 400
  ) {
    return;
  }
  console.log(
    JSON.stringify({
      level: "info",
      event: "connector_metric",
      kind: input.kind.slice(0, 80),
      route: (input.route ?? "").slice(0, 160),
      status: (input.status ?? "").slice(0, 80),
      connectorKey: (input.connectorKey ?? "").slice(0, 80),
      userId: input.userId ?? "system",
      durationMs: Math.max(0, input.durationMs ?? 0),
      value: Number.isFinite(input.value) ? (input.value ?? 0) : 0,
    }),
  );
}
