"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api/client";
import {
  PRIORITY_CONNECTORS,
  type ConnectorApproval,
} from "@/lib/plugin-connectors";
import type { PluginConnections } from "./use-plugin-connections";

const BUTTON =
  "inline-flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-[13px] font-medium hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]";

function SignInLink({ pluginId }: { pluginId: string }) {
  return (
    <a
      className={BUTTON}
      href={`/login?redirectTo=${encodeURIComponent(`/plugins?p=${pluginId}`)}`}
    >
      Sign in to connect
    </a>
  );
}

export function ConnectorApprovalCard({
  approval,
  onResolved,
}: {
  approval: ConnectorApproval;
  onResolved?: (message: string, failed: boolean) => void;
}) {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [failed, setFailed] = useState(false);
  const expired = new Date(approval.expiresAt).getTime() <= Date.now();
  const pending = approval.status === "pending" && !expired && !resolved;

  const decide = async (decision: "approve" | "reject") => {
    if (
      !user ||
      busy ||
      !pending ||
      new Date(approval.expiresAt).getTime() <= Date.now()
    )
      return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await apiFetch<unknown>(
        `/api/v1/plugins/approvals/${encodeURIComponent(approval.id)}`,
        {
          method: "POST",
          body: JSON.stringify({ decision }),
        },
      );
      setResolved(true);
      let responseMessage = "Rejected. This action was not approved.";
      let responseFailed = false;
      if (decision === "approve") {
        const record =
          result && typeof result === "object"
            ? (result as Record<string, unknown>)
            : {};
        const action = record.approval;
        const status = action && typeof action === "object"
          ? (action as Record<string, unknown>).status
          : undefined;
        if (status === "complete")
          responseMessage =
            "Action completed. You can ask the assistant to continue without repeating it.";
        else if (status === "failed" || status === "unknown") {
          responseFailed = true;
          responseMessage =
            "Completion was not confirmed. Check the connected app before retrying.";
        } else
          responseMessage =
            "Approval received. Refresh to check the action's result; do not repeat it.";
      }
      setMessage(responseMessage);
      setFailed(responseFailed);
      onResolved?.(responseMessage, responseFailed);
      window.dispatchEvent(new Event("plugin-connections-changed"));
    } catch {
      // A lost response is ambiguous; do not encourage another execution.
      const responseMessage =
        "Unable to confirm the decision. Refresh the approval status and check the connected app before retrying.";
      setResolved(true);
      setFailed(true);
      setMessage(responseMessage);
      onResolved?.(responseMessage, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Connector action approval"
      className="rounded-xl border border-black/10 p-4 text-[13px] dark:border-white/15"
    >
      <h3 className="font-semibold">{approval.title}</h3>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        {approval.pluginId} · {approval.toolName}
      </p>
      <p className="mt-2">
        Review the exact action before approving. Approval performs this action
        on your connected account.
      </p>
      <pre className="app-scrollbar mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-100 p-3 font-mono text-[12px] dark:bg-white/[0.06]">
        {JSON.stringify(approval.arguments, null, 2)}
      </pre>
      <p className="mt-2 text-[12px] text-zinc-500">
        Expires: {new Date(approval.expiresAt).toLocaleString()}
      </p>
      {message ? (
        <p role={failed ? "alert" : "status"} className="mt-3">
          {message}
        </p>
      ) : null}
      {pending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {!user && !loading ? (
            <SignInLink pluginId={approval.pluginId} />
          ) : (
            <>
              <button
                type="button"
                className={BUTTON}
                disabled={busy || loading || !user}
                onClick={() => {
                  void decide("approve");
                }}
              >
                {busy ? "Submitting…" : "Approve"}
              </button>
              <button
                type="button"
                className={BUTTON}
                disabled={busy || loading || !user}
                onClick={() => {
                  void decide("reject");
                }}
              >
                Reject
              </button>
            </>
          )}
        </div>
      ) : !message ? (
        <p role="status" className="mt-3">
          {expired && approval.status === "pending"
            ? "This approval has expired. Request a new preview."
            : approval.status === "complete"
              ? "Action completed."
              : approval.status === "failed" || approval.status === "unknown"
                ? "Completion was not confirmed. Check the connected app before retrying."
                : `Action status: ${approval.status}. Do not repeat this action.`}
        </p>
      ) : null}
    </section>
  );
}

export function PluginConnectionPanel({
  pluginId,
  connections: overview,
}: {
  pluginId: string;
  connections: PluginConnections;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    message: string;
    failed: boolean;
  } | null>(null);
  const supported = PRIORITY_CONNECTORS.some(
    (connector) => connector.id === pluginId,
  );
  const availability = overview.availability.find(
    (item) => item.pluginId === pluginId,
  );
  const accounts = overview.connections.filter(
    (item) => item.pluginId === pluginId,
  );
  const approvals = overview.approvals.filter(
    (item) => item.pluginId === pluginId && item.status === "pending",
  );
  const needsReauthorization = accounts.some(
    (account) => account.status === "reauthorization_required",
  );
  const callbackStatus =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("connection");

  const disconnect = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/v1/plugins/connections/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setConfirmId(null);
      await overview.refresh();
    } catch {
      setError(
        "Disconnect could not be confirmed. Refresh your connections before trying again.",
      );
    } finally {
      setBusyId(null);
    }
  };

  if (!supported) {
    return (
      <p className="mt-6 text-[13px] text-zinc-500 dark:text-zinc-400">
        Connector not available yet. This listing describes capabilities only.
      </p>
    );
  }

  return (
    <section
      aria-label="Plugin connection"
      className="mt-6 rounded-2xl border border-black/[0.08] p-4 dark:border-white/10"
    >
      <h2 className="text-[15px] font-semibold">Your connection</h2>
      {actionMessage ? (
        <p
          role={actionMessage.failed ? "alert" : "status"}
          className="mt-3 text-[13px]"
        >
          {actionMessage.message}
        </p>
      ) : null}
      {callbackStatus === "success" ? (
        <p role="status" className="mt-2 text-[13px]">
          Authorization returned. Checking your account connection below.
        </p>
      ) : null}
      {callbackStatus === "error" ? (
        <p role="alert" className="mt-2 text-[13px]">
          Authorization did not complete. Your account was not newly connected.
        </p>
      ) : null}
      {overview.unauthorized ? (
        <div className="mt-3">
          <SignInLink pluginId={pluginId} />
        </div>
      ) : overview.loading ? (
        <p role="status" className="mt-3 text-[13px] text-zinc-500">
          Checking connections…
        </p>
      ) : overview.error ? (
        <div className="mt-3 text-[13px]">
          <p role="alert">{overview.error}</p>
          <button
            type="button"
            className={`${BUTTON} mt-2`}
            onClick={() => {
              void overview.refresh();
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {accounts.length ? (
            <ul className="mt-3 space-y-3">
              {accounts.map((account) => (
                <li key={account.id} className="text-[13px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{account.accountLabel}</p>
                      <p className="text-zinc-500">
                        {account.status === "active"
                          ? "Connected"
                          : "Reauthorization required"}{" "}
                        · {new Date(account.connectedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {pluginId !== "github" ? (
                      <button
                        type="button"
                        className={BUTTON}
                        disabled={busyId !== null}
                        onClick={() => setConfirmId(account.id)}
                      >
                        Disconnect
                      </button>
                    ) : null}
                  </div>
                  {account.grantedScopes.length ? (
                    <p className="mt-1 break-words text-[12px] text-zinc-500">
                      Granted permissions: {account.grantedScopes.join(", ")}
                    </p>
                  ) : null}
                  {confirmId === account.id ? (
                    <div className="mt-2 rounded-lg bg-zinc-100 p-3 dark:bg-white/[0.06]">
                      <p>
                        Disconnect {account.accountLabel}? The assistant will
                        lose access. Existing data in the provider is not
                        deleted.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className={BUTTON}
                          disabled={busyId !== null}
                          onClick={() => {
                            void disconnect(account.id);
                          }}
                        >
                          {busyId === account.id
                            ? "Disconnecting…"
                            : "Confirm disconnect"}
                        </button>
                        <button
                          type="button"
                          className={BUTTON}
                          disabled={busyId !== null}
                          onClick={() => setConfirmId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-zinc-500">
              Not connected. Authorize your account to let the assistant use
              this app.
            </p>
          )}
          {availability ? (
            <div className="mt-4 text-[13px]">
              {availability.scopes.length ? (
                <details className="mb-3" open>
                  <summary className="cursor-pointer font-medium">
                    Requested permissions before authorization
                  </summary>
                  <ul className="mt-2 list-inside list-disc space-y-1 break-words text-[12px] text-zinc-500">
                    {availability.scopes.map((scope) => (
                      <li key={scope}>{scope}</li>
                    ))}
                  </ul>
                </details>
              ) : (
                <p className="mb-3 text-zinc-500">
                  Review account access on the provider's authorization screen.
                </p>
              )}
              {!availability.ready ? (
                <p className="mb-3 text-zinc-500">
                  Setup pending:{" "}
                  {availability.reason ||
                    "This connector's OAuth app is not configured."}{" "}
                  No developer credentials are needed from you.
                </p>
              ) : null}
              {pluginId === "github" ? (
                <a href="/github" className={BUTTON}>
                  Manage GitHub connection
                </a>
              ) : (
                <form
                  method="post"
                  action={`/api/v1/plugins/connect/${encodeURIComponent(pluginId)}`}
                >
                  <button
                    type="submit"
                    className={BUTTON}
                    disabled={!availability.ready}
                  >
                    {needsReauthorization || accounts.length
                      ? "Reconnect"
                      : "Connect"}
                  </button>
                </form>
              )}
              <p className="mt-2 text-[12px] text-zinc-500">
                You will authorize on the official provider website. Never share
                tokens or passwords with the assistant.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-zinc-500">
              Connection setup is currently unavailable.
            </p>
          )}
          {error ? (
            <p role="alert" className="mt-3 text-[13px]">
              {error}
            </p>
          ) : null}
          {approvals.length ? (
            <div className="mt-4 space-y-3">
              {approvals.map((approval) => (
                <ConnectorApprovalCard
                  key={approval.id}
                  approval={approval}
                  onResolved={(message, failed) =>
                    setActionMessage({ message, failed })
                  }
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
