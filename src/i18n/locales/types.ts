// Same keys as the German source, any string values. A missing key is a tsc error.
export type LocaleShape<T> = { [K in keyof T]: T[K] extends string ? string : LocaleShape<T[K]> };
