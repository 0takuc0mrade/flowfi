import { Context } from "nexus";

export const createContext = (
  prisma: any,
  // Auth, rate limiting, and OpenTelemetry request context would be integrated here
): Context<any> => ({
  prisma,
  // auth: ...,
  // rateLimiter: ...,
  // otel: ...,
});