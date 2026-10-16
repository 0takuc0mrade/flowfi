import { queryField, list, stringArg, intArg, floatArg } from "nexus";
import { batchStreamsByIds, batchEventsByStreamIds } from "../graphql/dataloaders.ts";
import { Stream, StreamEvent } from "./schema.ts";

export const StreamResolvers = {
  Query: {
    stream: queryField("stream", {
      args: {
        streamId: intArg({ required: true }),
      },
      resolve: (_parent, { streamId }, ctx) => {
        return ctx.prisma.stream.findUnique({
          where: { streamId },
          include: { events: true },
        });
      },
    }),
    streams: queryField("streams", {
      type: "StreamConnection!",
      args: {
        filter: stringArg({ nullable: true }),
        pagination: stringArg({ nullable: true }),
      },
      resolve: (_parent, { filter, pagination }, ctx) => {
        const where: any = filter
          ? {
              AND: [
                filter.status && { isActive: filter.status === "active" },
                filter.tokenAddress && { tokenAddress: filter.tokenAddress },
                filter.sender && { sender: filter.sender },
                filter.recipient && { recipient: filter.recipient },
              ].filter(Boolean),
            }
          : {};

        const take = (pagination?.limit as number) ?? 20;
        const cursor = pagination?.cursor ? BigInt(pagination.cursor) : undefined;

        const items = ctx.prisma.stream.findMany({
          where,
          take,
          cursor: cursor ? { streamId: cursor } : undefined,
          orderBy: { streamId: "desc" },
          include: { events: true },
        });

        const hasNextPage = await ctx.prisma.stream.count({
          where: { streamId: { _lt: cursor } },
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
    }),
    accountOverview: queryField("accountOverview", {
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
          totalClaimable: "0",
          activeStreams: senderActive + recipientActive,
        }));
      },
    }),
  },

  Stream: {
    events: (_parent, _args, ctx) => {
      return ctx.prisma.streamEvent.findMany({
        where: { streamId: _parent.streamId },
        orderBy: { timestamp: "desc" },
      });
    },
    positions: (_parent, _args, ctx) => {
      // Would return position metadata for this stream
      return [];
    },
  },

  StreamEvent: {
    stream: (_parent, _args, ctx) => {
      return ctx.prisma.stream.findUnique({
        where: { streamId: _parent.streamId },
      });
    },
  },
};