import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { SafeLoggerService } from '../observability/safe-logger.service';
import type { RequestWithId } from './request-id.middleware';
import { redactSensitiveValues } from './redaction.util';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: SafeLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();

    if (response.headersSent) {
      return;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error('http.exception.unhandled', {
        event: 'http.exception.unhandled',
        requestId: request.requestId,
        method: request.method,
        path: (request.originalUrl || request.url).split('?')[0],
        statusCode: status,
        error: this.logger.toErrorFields(exception),
      });
    }

    const body =
      exception instanceof HttpException
        ? this.normalizeHttpExceptionResponse(exception.getResponse(), status)
        : {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Internal server error',
          };

    response.status(status).json(redactSensitiveValues(body));
  }

  private normalizeHttpExceptionResponse(
    exceptionResponse: string | object,
    status: number,
  ): Record<string, unknown> {
    if (typeof exceptionResponse === 'string') {
      return {
        statusCode: status,
        message: exceptionResponse,
      };
    }

    return exceptionResponse as Record<string, unknown>;
  }
}
