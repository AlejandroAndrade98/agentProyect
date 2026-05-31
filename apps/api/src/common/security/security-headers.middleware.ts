import type { NextFunction, Request, Response } from 'express';

type SecurityHeadersOptions = {
  isProduction: boolean;
};

export function createSecurityHeadersMiddleware({
  isProduction,
}: SecurityHeadersOptions) {
  return (_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-DNS-Prefetch-Control', 'off');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );

    if (isProduction) {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=15552000; includeSubDomains',
      );
    }

    next();
  };
}
