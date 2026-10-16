// DataLoader batching helpers for GraphQL queries.

import { Stream, StreamEvent } from "../generated/prisma/client.ts";

// Batch stream lookups into a single SQL WHERE id IN (...)
export const batchStreamsByIds = async (
  streamIds: readonly bigint[],
): Promise<Map<bigint, Stream>> => {
  const ids = Array.from(streamIds);
  const result = new Map<bigint, Stream>();

  // In a real implementation, this would query the DB for these stream IDs
  // For now, return empty results
  for (const id of ids) {
    result.set(id, null);
  }

  return result;
};

// Group events for multiple streams in a single indexed query
export const batchEventsByStreamIds = async (
  streamIds: readonly bigint[],
): Promise<Map<bigint, StreamEvent[]>> => {
  const ids = Array.from(streamIds);
  const result = new Map<bigint, StreamEvent[]>();

  // In a real implementation, this would query events by stream IDs
  // For now, return empty arrays
  for (const id of ids) {
    result.set(id, []);
  }

  return result;
};

// In-memory cached token metadata lookups
export const batchTokensByAddresses = async (
  addresses: readonly string[],
): Promise<Map<string, { symbol: string; name: string; decimals: number; iconUrl?: string }>> => {
  const addrs = Array.from(addresses);
  const result = new Map<string, { symbol: string; name: string; decimals: number; iconUrl?: string }>();

  // In a real implementation, this would query TokenRegistry for these addresses
  // For now, return cached/default values
  for (const addr of addrs) {
    result.set(addr, {
      symbol: "",
      name: "",
      decimals: 6,
      iconUrl: undefined,
    });
  }

  return result;
};