import { defineMiddleware, sequence } from 'astro:middleware';
import { middleware } from 'astro:i18n';

const i18nMiddleware = middleware({
  prefixDefaultLocale: true,
  redirectToDefaultLocale: false,
});

const adminBypass = defineMiddleware((context, next) => {
  if (context.url.pathname.startsWith('/admin')) {
    return next();
  }
  return i18nMiddleware(context, next);
});

export const onRequest = adminBypass;
