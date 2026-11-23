export const config = {
  fallbackLocale: 'en',
  initialLocale: 'en',
  locales: ['en', 'es', 'fr', 'pt'] as const
};

export type Locale = typeof config.locales[number];
