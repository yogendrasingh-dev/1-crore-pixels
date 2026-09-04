// Extracts the client IP/user-agent from a request for fraud/rate-limit signals only —
// never stored or returned raw (docs/DATABASE.md §7, CLAUDE.md §10). Salted hashes are
// computed via packages/core's hashIp/hashUserAgent.
import { hashIp, hashUserAgent } from "@1crore-pixels/core";
import { env } from "./env";

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim();
  return ip || "unknown";
}

export interface RequestSignals {
  ip: string;
  ipHash: string;
  userAgentHash: string | undefined;
}

export function getRequestSignals(request: Request): RequestSignals {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");
  return {
    ip,
    ipHash: hashIp(ip, env.IP_HASH_SALT),
    userAgentHash: userAgent ? hashUserAgent(userAgent, env.IP_HASH_SALT) : undefined,
  };
}
