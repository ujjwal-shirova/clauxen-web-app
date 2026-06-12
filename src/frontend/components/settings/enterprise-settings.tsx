"use client";

import { useEnterprise } from "@/frontend/hooks/use-enterprise";

const DISPLAY_TEXT_MAX_LENGTH = 200;

function sanitizeDisplayText(value: string | null | undefined): string {
  if (!value) return "";
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\ufeff]/g, "")
    .trim();
  if (cleaned.length <= DISPLAY_TEXT_MAX_LENGTH) return cleaned;
  return `${cleaned.slice(0, DISPLAY_TEXT_MAX_LENGTH)}…`;
}

export function EnterpriseSettings() {
  const {
    workspace,
    members,
    ssoConnections,
    domains,
    scimStubMessage,
    loading,
    error,
  } = useEnterprise();

  if (loading) {
    return (
      <p className="text-sm text-zinc-500">Loading enterprise settings…</p>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300 text-zinc-800">
      <section className="flex flex-col gap-4 pb-8 border-b border-zinc-200">
        <h2 className="text-[16px] font-semibold">Workspace</h2>

        {workspace ? (
          <div className="text-sm space-y-1">
            <p>
              <span className="text-zinc-500">Name:</span> {workspace.name}
            </p>
            <p>
              <span className="text-zinc-500">ID:</span>{" "}
              <span className="font-mono text-[12px]">{workspace.id}</span>
            </p>
            <p>
              <span className="text-zinc-500">Plan:</span>{" "}
              {workspace.plan_id ?? "—"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            No workspace found for this account.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4 pb-8 border-b border-zinc-200">
        <h2 className="text-[16px] font-semibold">
          Members ({members.length})
        </h2>

        {members.length === 0 ? (
          <p className="text-sm text-zinc-500">No members yet.</p>
        ) : (
          <ul className="text-sm space-y-2">
            {members.map((member) => (
              <li key={member.id} className="flex justify-between gap-4">
                <span>
                  {member.display_name ?? member.email ?? member.user_id}
                </span>

                <span className="text-zinc-500 capitalize">
                  {member.role} · {member.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4 pb-8 border-b border-zinc-200">
        <h2 className="text-[16px] font-semibold">SSO connections</h2>

        {ssoConnections.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No SSO connections configured.
          </p>
        ) : (
          <ul className="text-sm space-y-2">
            {ssoConnections.map((conn) => (
              <li key={conn.id} className="flex justify-between gap-4">
                <span>
                  {conn.provider.toUpperCase()}

                  {conn.issuer_url
                    ? ` · ${sanitizeDisplayText(conn.issuer_url)}`
                    : ""}
                </span>
                <span className="text-zinc-500 capitalize">{conn.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4 pb-8 border-b border-zinc-200">
        <h2 className="text-[16px] font-semibold">Verified domains</h2>

        {domains.length === 0 ? (
          <p className="text-sm text-zinc-500">No domains added.</p>
        ) : (
          <ul className="text-sm space-y-2">
            {domains.map((domain) => (
              <li key={domain.id} className="flex justify-between gap-4">
                <span>{domain.domain}</span>

                <span className="text-zinc-500">
                  {domain.verified_at ? "Verified" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[16px] font-semibold">SCIM provisioning</h2>

        <p className="text-sm text-zinc-500">
          {scimStubMessage ??
            "SCIM token management is read-only until the provisioning API ships."}
        </p>
      </section>
    </div>
  );
}
