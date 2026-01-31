export const config = {
  fallbackLocale: 'en',
  initialLocale: 'en',
  locales: ['en', 'pt'] as const
};

export type Locale = typeof config.locales[number];
