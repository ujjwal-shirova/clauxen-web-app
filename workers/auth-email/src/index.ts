/**
 * Clauxen auth-email Worker
 * - POST /v1/otp/send   → generate 6-digit OTP, store hash in KV, email via Email Service
 * - POST /v1/otp/verify → verify code, issue one-time signup ticket
 * - POST /v1/otp/consume-ticket → mark ticket used (called by Next after account create)
 * - POST /v1/magic/send → email a 5-minute magic link (signup for new users)
 * - POST /v1/magic/inspect → peek magic token without burning it
 * - POST /v1/magic/consume → burn magic token, issue signup ticket
 *
 * Auth: Authorization: Bearer <AUTH_EMAIL_INTERNAL_TOKEN> or x-clauxen-internal header.
 */

export interface Env {
  EMAIL?: {
    send: (msg: {
      to: string | { email: string; name?: string };
      from: string | { email: string; name?: string };
      subject: string;
      html?: string;
      text?: string;
    }) => Promise<{ messageId?: string }>;
  };
  OTP_STORE: KVNamespace;
  AUTH_EMAIL_INTERNAL_TOKEN?: string;
  FROM_EMAIL?: string;
  FROM_NAME?: string;
  OTP_TTL_SECONDS?: string;
  OTP_MAX_ATTEMPTS?: string;
  OTP_RESEND_COOLDOWN_SECONDS?: string;
  MAGIC_LINK_TTL_SECONDS?: string;
  MAGIC_LINK_COOLDOWN_SECONDS?: string;
}

type OtpRecord = {
  hash: string;
  salt: string;
  attempts: number;
  createdAt: number;
  lastSentAt: number;
};

type TicketRecord = {
  email: string;
  createdAt: number;
  used: boolean;
};

type MagicRecord = {
  email: string;
  purpose: "signup";
  createdAt: number;
  expiresAt: number;
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers":
    "authorization,content-type,x-clauxen-internal",
  "access-control-max-age": "86400",
};

function json(data: unknown, status = 200, extra?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...CORS,
      ...extra,
    },
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

function authorized(request: Request, env: Env): boolean {
  const token = env.AUTH_EMAIL_INTERNAL_TOKEN?.trim();
  if (!token) return false;
  const header =
    request.headers.get("x-clauxen-internal") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(header && header === token);
}

function otpKey(email: string) {
  return `otp:signup:${email}`;
}

function ticketKey(ticket: string) {
  return `ticket:signup:${ticket}`;
}

function cooldownKey(email: string) {
  return `cooldown:signup:${email}`;
}

function magicKey(token: string) {
  return `magic:signup:${token}`;
}

function magicCooldownKey(email: string) {
  return `cooldown:magic:${email}`;
}

function safeAppOrigin(origin: string | undefined): string {
  const raw = (origin ?? "https://www.clauxen.com").trim().replace(/\/$/, "");
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return "https://www.clauxen.com";
    }
    return u.origin;
  } catch {
    return "https://www.clauxen.com";
  }
}

function randomDigits(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += String(bytes[i]! % 10);
  }
  return out;
}

function randomTicket(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashOtp(code: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${code}`);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function buildEmailHtml(code: string, ttlMinutes: number): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:440px;background:#ffffff;border-radius:12px;padding:28px 24px;border:1px solid #e4e4e7;">
          <tr><td style="font-size:20px;font-weight:600;color:#18181b;padding-bottom:8px;">Verify your Clauxen account</td></tr>
          <tr><td style="font-size:14px;line-height:1.55;color:#52525b;padding-bottom:20px;">Enter this 6-digit code to finish creating your account. It expires in ${ttlMinutes} minutes.</td></tr>
          <tr><td align="center" style="font-size:32px;letter-spacing:0.35em;font-weight:700;color:#18181b;padding:12px 0 20px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${code}</td></tr>
          <tr><td style="font-size:12px;line-height:1.5;color:#a1a1aa;">If you did not request this, you can ignore this email.</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildMagicEmailHtml(magicUrl: string, ttlMinutes: number): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:440px;background:#ffffff;border-radius:16px;padding:32px 28px;border:1px solid #e4e4e7;">
          <tr><td style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-weight:600;color:#a1a1aa;padding-bottom:10px;">Clauxen</td></tr>
          <tr><td style="font-size:22px;font-weight:650;color:#18181b;padding-bottom:10px;letter-spacing:-0.02em;">Your magic link is ready</td></tr>
          <tr><td style="font-size:14px;line-height:1.6;color:#52525b;padding-bottom:24px;">One tap opens the door — no code to type. This link creates your account and expires in <strong>${ttlMinutes} minutes</strong>.</td></tr>
          <tr>
            <td align="center" style="padding-bottom:22px;">
              <a href="${magicUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 28px;border-radius:999px;">Open magic link</a>
            </td>
          </tr>
          <tr><td style="font-size:12px;line-height:1.55;color:#a1a1aa;word-break:break-all;">Or paste this URL:<br/><a href="${magicUrl}" style="color:#52525b;">${magicUrl}</a></td></tr>
          <tr><td style="font-size:12px;line-height:1.5;color:#a1a1aa;padding-top:18px;">If you did not request this, you can ignore this email.</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

type SendResult = {
  sent: boolean;
  messageId?: string;
  simulated?: boolean;
  errorCode?: string;
  errorMessage?: string;
};

async function deliverEmail(
  env: Env,
  email: string,
  subject: string,
  text: string,
  html: string,
  simulateLog: string,
): Promise<SendResult> {
  const fromEmail = (env.FROM_EMAIL || "no-reply@clauxen.com").trim();

  if (!env.EMAIL?.send) {
    console.log(`[auth-email] EMAIL binding missing — ${simulateLog}`);
    return { sent: false, simulated: true };
  }

  try {
    const response = await env.EMAIL.send({
      to: email,
      from: fromEmail,
      subject,
      html,
      text,
    });
    return { sent: true, messageId: response?.messageId };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const errorCode =
      e && typeof e === "object" && "code" in e ? String(e.code) : "unknown";
    const errorMessage =
      e && typeof e === "object" && "message" in e
        ? String(e.message)
        : String(err);
    console.error(
      `[auth-email] EMAIL.send failed code=${errorCode} message=${errorMessage}`,
    );
    return { sent: false, errorCode, errorMessage };
  }
}

async function sendOtpEmail(
  env: Env,
  email: string,
  code: string,
  ttlSeconds: number,
): Promise<SendResult> {
  const ttlMinutes = Math.max(1, Math.round(ttlSeconds / 60));
  return deliverEmail(
    env,
    email,
    `${code} is your Clauxen verification code`,
    `Your Clauxen verification code is ${code}. It expires in ${ttlMinutes} minutes.`,
    buildEmailHtml(code, ttlMinutes),
    `OTP for ${email}: ${code}`,
  );
}

async function sendMagicEmail(
  env: Env,
  email: string,
  magicUrl: string,
  ttlSeconds: number,
): Promise<SendResult> {
  const ttlMinutes = Math.max(1, Math.round(ttlSeconds / 60));
  return deliverEmail(
    env,
    email,
    "Your Clauxen magic link",
    `Open your Clauxen magic link to create your account (expires in ${ttlMinutes} minutes):\n\n${magicUrl}\n`,
    buildMagicEmailHtml(magicUrl, ttlMinutes),
    `Magic link for ${email}: ${magicUrl}`,
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        ok: true,
        email: Boolean(env.EMAIL),
        kv: Boolean(env.OTP_STORE),
      });
    }

    if (!authorized(request, env)) {
      return json({ error: "unauthorized" }, 401);
    }

    const ttl = Math.max(60, Number(env.OTP_TTL_SECONDS ?? "600") || 600);
    const maxAttempts = Math.max(3, Number(env.OTP_MAX_ATTEMPTS ?? "5") || 5);
    const cooldown = Math.max(
      15,
      Number(env.OTP_RESEND_COOLDOWN_SECONDS ?? "45") || 45,
    );


    if (url.pathname === "/v1/otp/send" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        email?: string;
      };
      const email = normalizeEmail(body.email ?? "");
      if (!isValidEmail(email)) {
        return json({ error: "invalid_email" }, 400);
      }

      const cool = await env.OTP_STORE.get(cooldownKey(email));
      if (cool) {
        return json(
          {
            error: "rate_limited",
            message: "Please wait before requesting another code.",
            retryAfterSeconds: cooldown,
          },
          429,
        );
      }

      const code = randomDigits(6);
      const salt = randomTicket().slice(0, 16);
      const hash = await hashOtp(code, salt);
      const now = Date.now();
      const record: OtpRecord = {
        hash,
        salt,
        attempts: 0,
        createdAt: now,
        lastSentAt: now,
      };

      await env.OTP_STORE.put(otpKey(email), JSON.stringify(record), {
        expirationTtl: ttl,
      });
      // Workers KV requires expirationTtl >= 60.
      await env.OTP_STORE.put(cooldownKey(email), "1", {
        expirationTtl: Math.max(60, cooldown),
      });

      let delivery: {
        sent: boolean;
        messageId?: string;
        simulated?: boolean;
        errorCode?: string;
        errorMessage?: string;
      };
      try {
        delivery = await sendOtpEmail(env, email, code, ttl);
      } catch (err) {
        const e = err as { code?: string; message?: string };
        return json(
          {
            error: "email_send_failed",
            code: e?.code ?? "unknown",
            message: e?.message ?? "Failed to send OTP email",
          },
          502,
        );
      }

      if (!delivery.sent && !delivery.simulated) {
        return json(
          {
            error: "email_send_failed",
            code: delivery.errorCode ?? "unknown",
            message: delivery.errorMessage ?? "Failed to send OTP email",
          },
          502,
        );
      }

      return json({
        ok: true,
        expiresInSeconds: ttl,
        delivered: delivery.sent,
        simulated: Boolean(delivery.simulated),
        // Only present when Email Service is not bound (local/dev). Production must not rely on this.
        ...(delivery.simulated ? { debugCode: code } : {}),
      });
    }

    if (url.pathname === "/v1/otp/verify" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        email?: string;
        code?: string;
      };
      const email = normalizeEmail(body.email ?? "");
      const code = String(body.code ?? "").replace(/\D/g, "").slice(0, 6);
      if (!isValidEmail(email) || code.length !== 6) {
        return json({ error: "invalid_request" }, 400);
      }

      const raw = await env.OTP_STORE.get(otpKey(email));
      if (!raw) {
        return json(
          { error: "expired", message: "Code expired. Request a new one." },
          400,
        );
      }

      const record = JSON.parse(raw) as OtpRecord;
      if (record.attempts >= maxAttempts) {
        await env.OTP_STORE.delete(otpKey(email));
        return json(
          {
            error: "too_many_attempts",
            message: "Too many attempts. Request a new code.",
          },
          429,
        );
      }

      const candidate = await hashOtp(code, record.salt);
      if (!timingSafeEqual(candidate, record.hash)) {
        record.attempts += 1;
        await env.OTP_STORE.put(otpKey(email), JSON.stringify(record), {
          expirationTtl: ttl,
        });
        return json(
          {
            error: "invalid_code",
            message: "Incorrect code. Try again.",
            attemptsRemaining: Math.max(0, maxAttempts - record.attempts),
          },
          400,
        );
      }

      // Success — burn OTP and issue one-time signup ticket.
      await env.OTP_STORE.delete(otpKey(email));
      const ticket = randomTicket();
      const ticketRecord: TicketRecord = {
        email,
        createdAt: Date.now(),
        used: false,
      };
      await env.OTP_STORE.put(ticketKey(ticket), JSON.stringify(ticketRecord), {
        expirationTtl: Math.min(ttl, 900),
      });

      return json({
        ok: true,
        verified: true,
        signupTicket: ticket,
        email,
      });
    }

    if (url.pathname === "/v1/otp/consume-ticket" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        ticket?: string;
        email?: string;
      };
      const ticket = String(body.ticket ?? "").trim();
      const email = normalizeEmail(body.email ?? "");
      if (!ticket || !isValidEmail(email)) {
        return json({ error: "invalid_request" }, 400);
      }

      const raw = await env.OTP_STORE.get(ticketKey(ticket));
      if (!raw) {
        return json({ error: "invalid_ticket" }, 400);
      }
      const record = JSON.parse(raw) as TicketRecord;
      if (record.used || record.email !== email) {
        return json({ error: "invalid_ticket" }, 400);
      }

      record.used = true;
      await env.OTP_STORE.put(ticketKey(ticket), JSON.stringify(record), {
        expirationTtl: 60,
      });
      // Immediate delete so ticket cannot be replayed.
      await env.OTP_STORE.delete(ticketKey(ticket));

      return json({ ok: true, email });
    }

    const magicTtl = Math.max(
      60,
      Number(env.MAGIC_LINK_TTL_SECONDS ?? "300") || 300,
    );
    const magicCooldown = Math.max(
      60,
      Number(env.MAGIC_LINK_COOLDOWN_SECONDS ?? "60") || 60,
    );

    if (url.pathname === "/v1/magic/send" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        email?: string;
        appOrigin?: string;
        purpose?: string;
      };
      const email = normalizeEmail(body.email ?? "");
      const purpose = body.purpose === "signup" ? "signup" : "signup";
      if (!isValidEmail(email)) {
        return json({ error: "invalid_email" }, 400);
      }
      // Existing-user magic login comes later — this Worker currently issues signup links only.
      if (purpose !== "signup") {
        return json({ error: "unsupported_purpose" }, 400);
      }

      const cool = await env.OTP_STORE.get(magicCooldownKey(email));
      if (cool) {
        return json(
          {
            error: "rate_limited",
            message: "Please wait before requesting another magic link.",
            retryAfterSeconds: magicCooldown,
          },
          429,
        );
      }

      const token = randomTicket();
      const now = Date.now();
      const record: MagicRecord = {
        email,
        purpose: "signup",
        createdAt: now,
        expiresAt: now + magicTtl * 1000,
      };
      await env.OTP_STORE.put(magicKey(token), JSON.stringify(record), {
        expirationTtl: magicTtl,
      });
      await env.OTP_STORE.put(magicCooldownKey(email), "1", {
        expirationTtl: magicCooldown,
      });

      const origin = safeAppOrigin(body.appOrigin);
      const magicUrl = `${origin}/auth/magic?token=${encodeURIComponent(token)}`;

      let delivery: SendResult;
      try {
        delivery = await sendMagicEmail(env, email, magicUrl, magicTtl);
      } catch (err) {
        const e = err as { code?: string; message?: string };
        return json(
          {
            error: "email_send_failed",
            code: e?.code ?? "unknown",
            message: e?.message ?? "Failed to send magic link email",
          },
          502,
        );
      }

      if (!delivery.sent && !delivery.simulated) {
        return json(
          {
            error: "email_send_failed",
            code: delivery.errorCode ?? "unknown",
            message: delivery.errorMessage ?? "Failed to send magic link email",
          },
          502,
        );
      }

      return json({
        ok: true,
        expiresInSeconds: magicTtl,
        delivered: delivery.sent,
        simulated: Boolean(delivery.simulated),
        ...(delivery.simulated ? { debugUrl: magicUrl } : {}),
      });
    }

    if (url.pathname === "/v1/magic/inspect" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        token?: string;
      };
      const token = String(body.token ?? "").trim();
      if (!token || token.length < 16) {
        return json({ error: "invalid_token" }, 400);
      }

      const raw = await env.OTP_STORE.get(magicKey(token));
      if (!raw) {
        return json(
          {
            error: "expired",
            message: "This magic link has expired. Request a new one.",
          },
          400,
        );
      }

      const record = JSON.parse(raw) as MagicRecord;
      const remainingMs = Math.max(0, record.expiresAt - Date.now());
      if (remainingMs <= 0) {
        await env.OTP_STORE.delete(magicKey(token));
        return json(
          {
            error: "expired",
            message: "This magic link has expired. Request a new one.",
          },
          400,
        );
      }

      return json({
        ok: true,
        email: record.email,
        purpose: record.purpose,
        expiresInSeconds: Math.ceil(remainingMs / 1000),
      });
    }

    if (url.pathname === "/v1/magic/consume" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        token?: string;
      };
      const token = String(body.token ?? "").trim();
      if (!token || token.length < 16) {
        return json({ error: "invalid_token" }, 400);
      }

      const raw = await env.OTP_STORE.get(magicKey(token));
      if (!raw) {
        return json(
          {
            error: "expired",
            message: "This magic link has expired. Request a new one.",
          },
          400,
        );
      }

      const record = JSON.parse(raw) as MagicRecord;
      if (record.expiresAt <= Date.now()) {
        await env.OTP_STORE.delete(magicKey(token));
        return json(
          {
            error: "expired",
            message: "This magic link has expired. Request a new one.",
          },
          400,
        );
      }

      // Burn magic token → one-time signup ticket (same shape as OTP verify).
      await env.OTP_STORE.delete(magicKey(token));
      const ticket = randomTicket();
      const ticketRecord: TicketRecord = {
        email: record.email,
        createdAt: Date.now(),
        used: false,
      };
      await env.OTP_STORE.put(ticketKey(ticket), JSON.stringify(ticketRecord), {
        expirationTtl: Math.min(magicTtl, 900),
      });

      return json({
        ok: true,
        verified: true,
        signupTicket: ticket,
        email: record.email,
        purpose: record.purpose,
      });
    }

    return json({ error: "not_found" }, 404);
  },
};
