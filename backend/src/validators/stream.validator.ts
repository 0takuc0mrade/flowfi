import { z } from 'zod';
import { parseStreamId } from '../lib/stream-id.js';

/** Soroban `i128` upper bound (2^127 - 1). Values above this overflow the
 * on-chain type and the Postgres i128 columns, so they must never pass
 * request validation. */
export const MAX_I128 = BigInt('170141183460469231731687303715884105727');

function isAtMostI128(val: string): boolean {
  try {
    return BigInt(val) <= MAX_I128;
  } catch {
    return true;
  }
}

export const createStreamSchema = z.object({
  streamId: z
    .union([z.number(), z.string(), z.bigint()])
    .transform((v, ctx) => {
      const parsed = parseStreamId(v);
      if (parsed === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'streamId must be a non-negative integer',
        });
        return z.NEVER;
      }
      return parsed;
    }),
  sender: z.string().min(1, 'Sender address is required'),
  recipient: z.string().min(1, 'Recipient address is required'),
  tokenAddress: z.string().min(1, 'Token address is required'),
  ratePerSecond: z
    .string()
    .regex(/^\d+$/, 'Rate must be a positive integer as string')
    .refine(isAtMostI128, { message: 'Rate exceeds maximum allowed value' }),
  depositedAmount: z
    .string()
    .regex(/^\d+$/, 'Amount must be a positive integer as string')
    .refine(isAtMostI128, { message: 'Amount exceeds maximum allowed value' }),
  startTime: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/).transform(v => parseInt(v))]),
});

export type CreateStreamInput = z.infer<typeof createStreamSchema>;
