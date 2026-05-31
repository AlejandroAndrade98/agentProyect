import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithId = Request & {
  requestId?: string;
};

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

export function requestIdMiddleware(
  request: RequestWithId,
  response: Response,
  next: NextFunction,
) {
  const incomingRequestId = request.header('x-request-id');
  const requestId =
    incomingRequestId && REQUEST_ID_PATTERN.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();

  request.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
}
