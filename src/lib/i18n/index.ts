import { writable, derived } from 'svelte/store';
import en from './locales/en.json';
import pt from './locales/pt.json';
import { config } from './config';

const translations: Record<string, any> = { en, pt };
export const defaultLocale = config.fallbackLocale;
export const currentLocale = writable(config.initialLocale);

function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  return typeof value === 'string' ? value : undefined;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const locale = defaultLocale;
  const messages = translations[locale as keyof typeof translations];
  let value = getNestedValue(messages, key);
  
  if (value === undefined) {
    value = getNestedValue(translations[defaultLocale], key);
  }
  
  if (value === undefined) {
    console.warn(`Translation key not found: ${key}`);
    return key;
  }
  
  if (params && 'count' in params) {
    const count = Number(params.count);
    const pluralKey = count === 1 ? `${key}_one` : `${key}_other`;
    const pluralValue = getNestedValue(messages, pluralKey) || getNestedValue(translations[defaultLocale], pluralKey);
    if (pluralValue) {
      value = pluralValue;
    }
  }
  
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      value = value!.replace(new RegExp(`{${k}}`, 'g'), String(v));
    });
  }
  
  return value || key;
}

function createTranslationStore() {
  return derived(currentLocale, ($locale) => {
    return (key: string, params?: Record<string, string | number>) => {
      const messages = translations[$locale as keyof typeof translations] || translations[defaultLocale];
      let value = getNestedValue(messages, key);
      
      if (value === undefined) {
        value = getNestedValue(translations[defaultLocale], key);
      }
      
      if (value === undefined) {
        return key;
      }
      
      if (params && 'count' in params) {
        const count = Number(params.count);
        const pluralKey = count === 1 ? `${key}_one` : `${key}_other`;
        const pluralMessages = translations[$locale as keyof typeof translations] || translations[defaultLocale];
        const pluralValue = getNestedValue(pluralMessages, pluralKey) || getNestedValue(translations[defaultLocale], pluralKey);
        if (pluralValue) {
          value = pluralValue;
        }
      }
      
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          value = value!.replace(new RegExp(`{${k}}`, 'g'), String(v));
        });
      }
      
      return value || key;
    };
  });
}

export const _ = createTranslationStore();
export { currentLocale as locale };
export { config, type Locale } from './config';

export type MessageFormatter = typeof t;
