import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Only import the initially active locale synchronously — the other is loaded on demand
const savedLanguage = localStorage.getItem('language') || 'en';

const loaders: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('./locales/en'),
  fr: () => import('./locales/fr'),
};

// Load the initial locale synchronously via eager import for instant rendering
async function bootstrap() {
  const initialTranslations = await loaders[savedLanguage]();

  await i18n
    .use(initReactI18next)
    .init({
      resources: {
        [savedLanguage]: { translation: initialTranslations.default },
      },
      lng: savedLanguage,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
    });

  // Persist language changes and lazy-load missing bundles
  i18n.on('languageChanged', async (lng) => {
    localStorage.setItem('language', lng);
    if (!i18n.hasResourceBundle(lng, 'translation')) {
      const mod = await loaders[lng]();
      i18n.addResourceBundle(lng, 'translation', mod.default);
    }
  });
}

// Bootstrap promise — consumers can await this to ensure translations are ready
export const i18nReady = bootstrap().then(() => {
  // Eagerly load fallback locale in background if it's not the active one
  if (savedLanguage !== 'en' && !i18n.hasResourceBundle('en', 'translation')) {
    loaders['en']().then((mod) => {
      i18n.addResourceBundle('en', 'translation', mod.default);
    });
  }
});

export default i18n;
