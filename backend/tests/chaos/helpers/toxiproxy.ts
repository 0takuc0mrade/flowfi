/**
 * Toxiproxy control-plane client + pre-baked fault descriptors for the
 * FlowFi chaos suite (issue #1477).
 *
 * The chaos stack is defined in `tests/chaos/docker-compose.chaos.yml`. It
 * exposes a Toxiproxy control API and three proxied dependencies:
 *
 *   - `soroban_rpc`  -> mock-soroban-rpc:8000   (also used for Redis/PG)
 *   - `redis`        -> redis:6379
 *   - `postgres`     -> postgres:5432
 *
 * Tests talk to the *proxies* (127.0.0.1:18000 / :16379 / :15432) and inject
 * toxics through this client. Everything here is deliberately dependency-free
 * (global `fetch` + `node:net`) so the suite also degrades gracefully to the
 * deterministic in-process fakes in `resilience.chaos.test.ts` when Docker is
 * unavailable.
 */

export const DEFAULT_TOXIPROXY_URL = process.env.TOXIPROXY_URL ?? 'http://127.0.0.1:8474';

export type ToxicStream = 'downstream' | 'upstream';

export interface ToxiproxyProxy {
  name: string;
  listen: string;
  upstream: string;
  enabled: boolean;
}

export interface ToxicDefinition {
  name: string;
  type: string;
  stream?: ToxicStream;
  toxicity?: number;
  attributes: Record<string, number | string | boolean>;
}

/**
 * Proxy definitions mirror `docker-compose.chaos.yml` / `toxiproxy.json`.
 * The host-side listen ports are what tests connect to.
 */
export const CHAOS_PROXIES = {
  sorobanRpc: {
    name: 'soroban_rpc',
    listen: '127.0.0.1:18000',
    upstream: 'mock-soroban-rpc:8000',
    enabled: true,
  },
  redis: {
    name: 'redis',
    listen: '127.0.0.1:16379',
    upstream: 'redis:6379',
    enabled: true,
  },
  postgres: {
    name: 'postgres',
    listen: '127.0.0.1:15432',
    upstream: 'postgres:5432',
    enabled: true,
  },
} as const satisfies Record<string, ToxiproxyProxy>;

/** Connection strings pointing at the chaos proxies rather than the originals. */
export const CHAOS_URLS = {
  sorobanRpc: 'http://127.0.0.1:18000',
  redis: 'redis://127.0.0.1:16379',
  postgres: 'postgresql://flowfi:flowfi_dev_password@127.0.0.1:15432/flowfi',
} as const;

// ---------------------------------------------------------------------------
// Toxic factories — each maps 1:1 to a scenario named in the issue.
// ---------------------------------------------------------------------------

/**
 * `soroban_rpc_latency`: 2,000ms latency with 10% packet jitter.
 */
export function latencyToxic(latencyMs = 2_000, jitterRatio = 0.1): ToxicDefinition {
  return {
    name: 'rpc_latency',
    type: 'latency',
    stream: 'downstream',
    toxicity: 1,
    attributes: {
      latency: latencyMs,
      jitter: Math.round(latencyMs * jitterRatio),
    },
  };
}

/**
 * `soroban_rpc_timeout`: drop the TCP connection after N bytes transmitted.
 * Implemented with Toxiproxy's `limit_data` toxic.
 */
export function dropAfterBytesToxic(bytes = 100): ToxicDefinition {
  return {
    name: 'rpc_limit_data',
    type: 'limit_data',
    stream: 'downstream',
    toxicity: 1,
    attributes: { bytes },
  };
}

/** Abruptly reset the TCP connection (simulates a node dropping the peer). */
export function resetPeerToxic(timeoutMs = 0): ToxicDefinition {
  return {
    name: 'rpc_reset_peer',
    type: 'reset_peer',
    stream: 'downstream',
    toxicity: 1,
    attributes: { timeout: timeoutMs },
  };
}

/**
 * `redis_kill_reconnect`: terminate the Redis connection midway. Modelled as a
 * peer reset on the Redis proxy (0ms timeout = immediately on next I/O).
 */
export function redisKillToxic(): ToxicDefinition {
  return {
    ...resetPeerToxic(0),
    name: 'redis_kill_reconnect',
  };
}

/**
 * `postgres_max_connections`: hold PG connections open without ever
 * responding, exhausting the client pool via backpressure.
 */
export function postgresHoldToxic(timeoutMs = 30_000): ToxicDefinition {
  return {
    name: 'postgres_hold',
    type: 'timeout',
    stream: 'downstream',
    toxicity: 1,
    attributes: { timeout: timeoutMs },
  };
}

/** Bandwidth cap (slow network) — useful for latency-sensitivity assertions. */
export function bandwidthToxic(kilobytesPerSecond = 16): ToxicDefinition {
  return {
    name: 'bandwidth_cap',
    type: 'bandwidth',
    stream: 'downstream',
    toxicity: 1,
    attributes: { rate: kilobytesPerSecond },
  };
}

// ---------------------------------------------------------------------------
// Control-plane client
// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
}

export class ToxiproxyClient {
  constructor(private readonly baseUrl: string = DEFAULT_TOXIPROXY_URL) {}

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, timeoutMs = 5_000 } = options;
    const init: RequestInit = {
      method,
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'content-type': 'application/json' },
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    const res = await fetch(`${this.baseUrl}${path}`, init);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`[Toxiproxy] ${method} ${path} -> ${res.status} ${text}`);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /** True when the Toxiproxy control API answers within the timeout. */
  async isAvailable(timeoutMs = 1_000): Promise<boolean> {
    try {
      await this.request<unknown>('/proxies', { timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  async waitUntilReady(timeoutMs = 30_000, intervalMs = 500): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;
    while (Date.now() < deadline) {
      try {
        if (await this.isAvailable(intervalMs)) return;
      } catch (err) {
        lastError = err;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(
      `[Toxiproxy] not ready after ${timeoutMs}ms` +
        (lastError ? `: ${String(lastError)}` : ''),
    );
  }

  listProxies(): Promise<ToxiproxyProxy[]> {
    return this.request<ToxiproxyProxy[]>('/proxies');
  }

  createProxy(proxy: ToxiproxyProxy): Promise<ToxiproxyProxy> {
    return this.request<ToxiproxyProxy>('/proxies', { method: 'POST', body: proxy });
  }

  deleteProxy(name: string): Promise<void> {
    return this.request<void>(`/proxies/${encodeURIComponent(name)}`, { method: 'DELETE' });
  }

  addToxic(proxyName: string, toxic: ToxicDefinition): Promise<ToxicDefinition> {
    return this.request<ToxicDefinition>(`/proxies/${encodeURIComponent(proxyName)}/toxics`, {
      method: 'POST',
      body: toxic,
    });
  }

  removeToxic(proxyName: string, toxicName: string): Promise<void> {
    return this.request<void>(
      `/proxies/${encodeURIComponent(proxyName)}/toxics/${encodeURIComponent(toxicName)}`,
      { method: 'DELETE' },
    );
  }

  /** Clear every toxic from every proxy, restoring a pristine network. */
  reset(): Promise<void> {
    return this.request<void>('/reset', { method: 'POST' });
  }

  /** Idempotently ensure the three FlowFi proxies exist. */
  async ensureProxies(): Promise<void> {
    const existing = new Set((await this.listProxies()).map((p) => p.name));
    for (const proxy of Object.values(CHAOS_PROXIES)) {
      if (!existing.has(proxy.name)) {
        await this.createProxy({ ...proxy });
      }
    }
  }
}

/**
 * Best-effort readiness probe used to decide whether the Docker chaos stack is
 * up. Tests skip their integration portions when this returns false rather than
 * failing, mirroring `tests/integration/_db.ts`.
 */
export async function isChaosStackReady(
  client: ToxiproxyClient = new ToxiproxyClient(),
): Promise<boolean> {
  return client.isAvailable();
}
