import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';

import type { CurrentUser } from '../../auth/interfaces/current-user.interface';
import { SafeLoggerService } from '../observability/safe-logger.service';
import {
  RATE_LIMIT_METADATA_KEY,
  type RateLimitOptions,
} from './rate-limit.decorator';

type RequestWithUser = Request & {
  requestId?: string;
  user?: CurrentUser;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();
const MAX_BUCKETS_BEFORE_PRUNE = 10000;

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: SafeLoggerService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const now = Date.now();
    if (buckets.size > MAX_BUCKETS_BEFORE_PRUNE) {
      this.pruneExpiredBuckets(now);
    }

    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithUser>();
    const response = http.getResponse<Response>();
    const key = this.buildBucketKey(options, request);
    const existingBucket = buckets.get(key);

    if (!existingBucket || existingBucket.resetAt <= now) {
      const resetAt = now + options.windowMs;
      buckets.set(key, { count: 1, resetAt });
      this.setRateLimitHeaders(response, options.max, options.max - 1, resetAt);
      return true;
    }

    if (existingBucket.count >= options.max) {
      this.setRateLimitHeaders(response, options.max, 0, existingBucket.resetAt);
      this.logger.warn('rate_limit.exceeded', {
        event: 'rate_limit.exceeded',
        requestId: request.requestId,
        category: options.name,
        keyStrategy: options.keyBy ?? 'ip',
        method: request.method,
        path: (request.originalUrl || request.url).split('?')[0],
        userId: request.user?.id,
        organizationId: request.user?.organizationId,
      });
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    existingBucket.count += 1;
    this.setRateLimitHeaders(
      response,
      options.max,
      options.max - existingBucket.count,
      existingBucket.resetAt,
    );

    return true;
  }

  private buildBucketKey(
    options: RateLimitOptions,
    request: RequestWithUser,
  ): string {
    const strategy = options.keyBy ?? 'ip';
    const ip = this.getClientIp(request);

    if (strategy === 'userOrIp' && request.user?.id) {
      return `${options.name}:user:${this.hash(request.user.id)}`;
    }

    if (strategy === 'ipAndBodyEmail') {
      const email =
        typeof request.body?.email === 'string'
          ? request.body.email.trim().toLowerCase()
          : 'unknown-email';

      return `${options.name}:ip-email:${this.hash(`${ip}:${email}`)}`;
    }

    return `${options.name}:ip:${this.hash(ip)}`;
  }

  private getClientIp(request: Request): string {
    return request.ip || request.socket.remoteAddress || 'unknown-ip';
  }

  private setRateLimitHeaders(
    response: Response,
    limit: number,
    remaining: number,
    resetAt: number,
  ) {
    response.setHeader('X-RateLimit-Limit', String(limit));
    response.setHeader('X-RateLimit-Remaining', String(Math.max(remaining, 0)));
    response.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil(resetAt / 1000)),
    );
  }

  private pruneExpiredBuckets(now: number) {
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
