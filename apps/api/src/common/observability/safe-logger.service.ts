import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

import { redactSensitiveValues } from '../security/redaction.util';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogFormat = 'json' | 'pretty';

type LogFields = Record<string, unknown>;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

@Injectable()
export class SafeLoggerService {
  constructor(private readonly configService: ConfigService) {}

  debug(message: string, fields: LogFields = {}) {
    this.write('debug', message, fields);
  }

  info(message: string, fields: LogFields = {}) {
    this.write('info', message, fields);
  }

  warn(message: string, fields: LogFields = {}) {
    this.write('warn', message, fields);
  }

  error(message: string, fields: LogFields = {}) {
    this.write('error', message, fields);
  }

  hashIdentifier(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    return createHash('sha256').update(value).digest('hex');
  }

  toErrorFields(error: unknown) {
    if (error instanceof Error) {
      return {
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack,
      };
    }

    return {
      errorName: 'UnknownError',
      errorMessage: String(error),
    };
  }

  private write(level: LogLevel, message: string, fields: LogFields) {
    if (!this.shouldLog(level)) {
      return;
    }

    const payload = this.shouldRedact()
      ? redactSensitiveValues(fields)
      : fields;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...payload,
    };

    if (this.getLogFormat() === 'pretty') {
      const rendered = `${entry.timestamp} ${level.toUpperCase()} ${message} ${JSON.stringify(
        payload,
      )}`;
      this.writeToConsole(level, rendered);
      return;
    }

    this.writeToConsole(level, JSON.stringify(entry));
  }

  private shouldLog(level: LogLevel) {
    const configuredLevel =
      this.configService.get<string>('app.logLevel')?.toLowerCase() ?? 'info';
    const minimumLevel = this.isLogLevel(configuredLevel)
      ? configuredLevel
      : 'info';

    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minimumLevel];
  }

  private shouldRedact() {
    return (
      this.configService.get<string>('app.logRedactSensitive') ?? 'true'
    ).toLowerCase() !== 'false';
  }

  private getLogFormat(): LogFormat {
    const format =
      this.configService.get<string>('app.logFormat')?.toLowerCase() ?? 'json';

    return format === 'pretty' ? 'pretty' : 'json';
  }

  private isLogLevel(value: string): value is LogLevel {
    return value in LOG_LEVEL_PRIORITY;
  }

  private writeToConsole(level: LogLevel, rendered: string) {
    if (level === 'error') {
      console.error(rendered);
      return;
    }

    if (level === 'warn') {
      console.warn(rendered);
      return;
    }

    console.log(rendered);
  }
}
