import type de from './de';

// Same keys as de, any string values. A missing key is a tsc error.
export type LocaleShape<T> = { [K in keyof T]: T[K] extends string ? string : LocaleShape<T[K]> };

const en: LocaleShape<typeof de> = {
  settings: {
    language: 'Language',
    languageGerman: 'Deutsch',
    languageEnglish: 'English',
  },
};

export default en;
