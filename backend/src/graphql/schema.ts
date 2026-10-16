import { extendType, nonNull, stringArg, intArg, floatArg, list, arg } from "nexus";
import "nexus-prisma";

export const Schema = extendType({
  type: "Query",
  definitions: (t) => ({
    stream: t.field({
      type: "Stream",
      args: {
        id: stringArg({ required: true }),
      },
      resolve: (_parent, { id }, ctx) => {
        return ctx.prisma.stream.findUnique({
          where: { streamId: BigInt(id) },
        });
      },
    }),
    // ... other fields
  }),
});