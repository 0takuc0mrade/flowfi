import { DataLoader } from "dataloader";
import { Stream, StreamEvent, TokenRegistry } from "../generated/prisma/client";

// Batch stream lookups into a single SQL WHERE id IN (...)
export const batchStreamsByIds = async (
  streamIds: readonly bigint[],
): Promise<Map<bigint, Stream>> {
  const ids = Array.from(streamIds);
  const streams = await new DataLoader<bigint, Stream>(async (ids) => {
    const streamIds = ids.map((id) => Number(id));
    const results = await Promise.resolve(
      // In a real implementation, this would query the DB for these stream IDs
      // For now, return empty results
      [],
    );
    return results as Stream[];
  });

  const result = new Map<bigint, Stream>();
  for (const id of ids) {
    result.set(id, streams.get(Number(id)) ?? null);
  }
  return result;
};

// Group events for multiple streams in a single indexed query
export const batchEventsByStreamIds = async (
  streamIds: readonly bigint[],
): Promise<Map<bigint, StreamEvent[]>> {
  const ids = Array.from(streamIds);
  const eventsMap = await new DataLoader<bigint, StreamEvent[]>(async (ids) => {
    const streamIds = ids.map((id) => Number(id));
    // In a real implementation, this would query events by stream IDs
    // For now, return empty arrays
    return Promise.resolve([] as StreamEvent[]);
  });

  const result = new Map<bigint, StreamEvent[]>();
  for (const id of ids) {
    result.set(id, eventsMap.get(Number(id)) ?? []);
  }
  return result;
};

// In-memory cached token metadata lookups
export const batchTokensByAddresses = async (
  addresses: readonly string[],
): Promise<Map<string, { symbol: string; name: string; decimals: number; iconUrl?: string }>> => {
  const addrs = Array.from(addresses);
  const tokenMap = await new DataLoader<string, { symbol: string; name: string; decimals: number; iconUrl?: string }>(async (addrs) => {
    // In a real implementation, this would query TokenRegistry for these addresses
    // For now, return cached/default values
    return addrs.map(() => ({
      symbol: "",
      name: "",
      decimals: 6,
      iconUrl: undefined,
    }));
  });

  const result = new Map<string, { symbol: string; name: string; decimals: number; iconUrl?: string }>();
  for (const addr of addrs) {
    result.set(addr, tokenMap.get(addr) ?? {
      symbol: "",
      name: "",
      decimals: 6,
      iconUrl: undefined,
    });
  }
  return result;
};