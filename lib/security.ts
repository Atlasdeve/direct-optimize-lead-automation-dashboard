import crypto from "crypto";

type RateLimitEntry = { count: number; resetAt: number };

const globalSecurity = globalThis as unknown as { rateLimits?: Map<string, RateLimitEntry> };
const rateLimits = globalSecurity.rateLimits ?? new Map<string, RateLimitEntry>();
if (process.env.NODE_ENV !== "production") globalSecurity.rateLimits = rateLimits;

export function requestFingerprint(request: Request, scope: string, identity = "") {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return crypto.createHash("sha256").update(`${scope}:${ip}:${identity.toLowerCase()}`).digest("hex");
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}
