import type { NextFunction, Request, Response } from 'express';

import type { CurrentUser } from '../../auth/interfaces/current-user.interface';
import type { RequestWithId } from '../security/request-id.middleware';
import { SafeLoggerService } from './safe-logger.service';

type RequestWithObservability = RequestWithId &
  Request & {
    user?: CurrentUser;
  };

type RequestLoggingOptions = {
  enabled: boolean;
};

export function createRequestLoggingMiddleware(
  logger: SafeLoggerService,
  options: RequestLoggingOptions,
) {
  return (
    request: RequestWithObservability,
    response: Response,
    next: NextFunction,
  ) => {
    if (!options.enabled) {
      next();
      return;
    }

    const startedAt = Date.now();

    response.on('finish', () => {
      const path = getSafePath(request);

      if (path === '/api/health' && response.statusCode < 500) {
        return;
      }

      const durationMs = Date.now() - startedAt;
      const statusCode = response.statusCode;
      const level =
        statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

      logger[level]('http.request.completed', {
        event: 'http.request.completed',
        requestId: request.requestId,
        method: request.method,
        path,
        statusCode,
        durationMs,
        userId: request.user?.id,
        organizationId: request.user?.organizationId,
      });
    });

    next();
  };
}

function getSafePath(request: Request) {
  const path = request.path || request.originalUrl || request.url;
  return path.split('?')[0];
}
