import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { RequestWithId } from './request-id.middleware';
import { redactSensitiveValues } from './redaction.util';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name);

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
      this.logger.error(
        JSON.stringify(
          redactSensitiveValues({
            requestId: request.requestId,
            method: request.method,
            path: request.originalUrl || request.url,
            status,
            error:
              exception instanceof Error
                ? {
                    name: exception.name,
                    message: exception.message,
                    stack: exception.stack,
                  }
                : exception,
          }),
        ),
      );
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
