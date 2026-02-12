import { defineMiddleware, sequence } from 'astro:middleware';
import { middleware } from 'astro:i18n';

const i18nMiddleware = middleware({
  prefixDefaultLocale: true,
  redirectToDefaultLocale: false,
});

const securityHeaders = defineMiddleware(async (context, next) => {
  const response = await next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (!context.url.pathname.startsWith('/admin')) {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
    );
  }

  return response;
});

const adminBypass = defineMiddleware((context, next) => {
  if (context.url.pathname.startsWith('/admin')) {
    return next();
  }
  return i18nMiddleware(context, next);
});

export const onRequest = sequence(adminBypass, securityHeaders);
