import { extendType, nonNull, stringArg, intArg, floatArg, list, arg } from "nexus";
import "nexus-prisma";
import { t } from "nexelex";

export const Schema = t.schema({
  types: {
    Stream: t.object({
      id: t.id.int(),
      streamId: t.bigInt(),
      sender: t.string(),
      recipient: t.string(),
      tokenAddress: t.string(),
      depositedAmount: t.string(),
      withdrawnAmount: t.string(),
      claimableAmount: t.string(),
      ratePerSecond: t.string(),
      startTime: t.bigInt(),
      endTime: t.bigInt(),
      status: t.string(),
      events: t.list(t.any()),
      positions: t.list(t.any()),
    }),
    Token: t.object({
      address: t.string(),
      symbol: t.string(),
      name: t.string(),
      decimals: t.int(),
      iconUrl: t.string(),
    }),
    StreamEvent: t.object({
      id: t.id.int(),
      streamId: t.bigInt(),
      eventType: t.string(),
      transactionHash: t.string(),
      ledgerSequence: t.int(),
      timestamp: t.bigInt(),
    }),
    StreamFilterInput: t.input({
      status: t.string(),
      tokenAddress: t.string(),
      sender: t.string(),
      recipient: t.string(),
    }),
    PaginationInput: t.input({
      cursor: t.string(),
      limit: t.int(),
    }),
    StreamConnection: t.object({
      edges: t.list(t.any()),
      node: t.any(),
      pageInfo: t.object({
        hasNextPage: t.boolean(),
        endCursor: t.string(),
      }),
    }),
    AccountOverview: t.object({
      totalDeposited: t.string(),
      totalWithdrawn: t.string(),
      totalClaimable: t.string(),
      activeStreams: t.int(),
    }),
  },
  queries: {
    stream: {
      type: "Stream",
      args: {
        id: stringArg({ required: true }),
      },
      resolve: (_parent, { id }, ctx) => {
        return ctx.prisma.stream.findUnique({
          where: { streamId: BigInt(id) },
        });
      },
    },
    streams: {
      type: "StreamConnection!",
      args: {
        filter: t.arg({ type: "StreamFilterInput", nullable: true }),
        pagination: t.arg({ type: "PaginationInput", nullable: true }),
      },
      resolve: (_parent, { filter, pagination }, ctx) => {
        const where = filter
          ? {
              AND: [
                filter.status && { isActive: filter.status === "active" },
                filter.tokenAddress && { tokenAddress: filter.tokenAddress },
                filter.sender && { sender: filter.sender },
                filter.recipient && { recipient: filter.recipient },
              ].filter(Boolean) as any,
            }
          : {};

        const take = pagination?.limit ?? 20;
        const cursor = pagination?.cursor ? BigInt(pagination.cursor) : undefined;

        const whereClause: any = {};
        if (cursor) {
          whereClause.streamId = { _lt: cursor };
        }

        const items = ctx.prisma.stream.findMany({
          where: { ...whereClause, ...(filter && {
            OR: [
              filter.status && { isActive: filter.status === "active" },
              filter.tokenAddress && { tokenAddress: filter.tokenAddress },
            ]}.filter(Boolean) as any),
          take,
          cursor: cursor ? { streamId: cursor } : undefined,
          orderBy: { streamId: "desc" },
          include: { events: true },
        });

        const hasNextPage = await ctx.prisma.stream.count({
          where: { ...whereClause, streamId: { _lt: cursor } },
        }) > 0;

        return {
          edges: items.map((stream) => ({
            node: stream,
            cursor: stream.streamId.toString(),
          })),
          pageInfo: {
            hasNextPage,
            endCursor: cursor ? cursor.toString() : null,
          },
        };
      },
    },
    accountOverview: {
      type: "AccountOverview",
      args: {
        address: stringArg({ required: true }),
      },
      resolve: (_parent, { address }, ctx) => {
        return ctx.prisma.$transaction([
          ctx.prisma.stream.aggregate({
            where: { sender: address },
            _sum: { depositedAmount: true, withdrawnAmount: true },
          }),
          ctx.prisma.stream.count({ where: { sender, isActive: true } }),
          ctx.prisma.stream.aggregate({
            where: { recipient: address },
            _sum: { depositedAmount: true, withdrawnAmount: true },
          }),
          ctx.prisma.stream.count({ where: { recipient, isActive: true } }),
        ]).then(([senderStats, senderActive, recipientStats, recipientActive]) => ({
          totalDeposited: senderStats._sum.depositedAmount ?? "0",
          totalWithdrawn: senderStats._sum.withdrawnAmount ?? "0",
          totalClaimable: "0", // Would need claimable calculation
          activeStreams: senderActive + recipientActive,
        }));
      },
    },
  },
  subscriptions: {
    streamUpdated: {
      type: "Stream",
      args: {
        streamId: stringArg({ required: true }),
      },
      resolve: (_parent, { streamId }, ctx) => {
        // Subscription would use pubsub or websocket in production
        return ctx.prisma.stream.findUnique({
          where: { streamId: BigInt(streamId) },
        });
      },
    },
    userStreams: {
      type: "StreamEvent",
      args: {
        address: stringArg({ required: true }),
      },
      resolve: (_parent, { address }, ctx) => {
        return ctx.prisma.streamEvent.findMany({
          where: {
            OR: [
              { stream: { sender: address } },
              { stream: { recipient: address } },
            ],
          },
          orderBy: { timestamp: "desc" },
        });
      },
    },
  },
});