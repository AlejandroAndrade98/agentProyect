import { SetMetadata } from '@nestjs/common';

export type RateLimitKeyStrategy =
  | 'ip'
  | 'ipAndBodyEmail'
  | 'ipAndBodyToken'
  | 'userOrIp';

export type RateLimitOptions = {
  name: string;
  windowMs: number;
  max: number;
  keyBy?: RateLimitKeyStrategy;
};

export const RATE_LIMIT_METADATA_KEY = 'security:rate-limit';

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_METADATA_KEY, options);
