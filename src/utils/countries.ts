// Countries a fighter can pick as the flag shown under their name. Codes are
// ISO 3166-1 alpha-2 (plus the UK home nations and Kosovo, which matter in
// combat sports). Names are static (German + English, the English ones
// generated once with Node's Intl.DisplayNames) because Intl.DisplayNames is not
// reliably available under Hermes. The list is kept in German alphabetical
// order (umlauts sorted like their base letter).

import type { AppLanguage } from './language';

export interface Country {
  code: string;
  name: string;
  nameEn: string;
}

export const COUNTRIES: readonly Country[] = [
  { code: 'AF', name: 'Afghanistan', nameEn: 'Afghanistan' },
  { code: 'EG', name: 'Ägypten', nameEn: 'Egypt' },
  { code: 'AL', name: 'Albanien', nameEn: 'Albania' },
  { code: 'DZ', name: 'Algerien', nameEn: 'Algeria' },
  { code: 'AD', name: 'Andorra', nameEn: 'Andorra' },
  { code: 'AO', name: 'Angola', nameEn: 'Angola' },
  { code: 'AG', name: 'Antigua und Barbuda', nameEn: 'Antigua & Barbuda' },
  { code: 'GQ', name: 'Äquatorialguinea', nameEn: 'Equatorial Guinea' },
  { code: 'AR', name: 'Argentinien', nameEn: 'Argentina' },
  { code: 'AM', name: 'Armenien', nameEn: 'Armenia' },
  { code: 'AZ', name: 'Aserbaidschan', nameEn: 'Azerbaijan' },
  { code: 'ET', name: 'Äthiopien', nameEn: 'Ethiopia' },
  { code: 'AU', name: 'Australien', nameEn: 'Australia' },
  { code: 'BS', name: 'Bahamas', nameEn: 'Bahamas' },
  { code: 'BH', name: 'Bahrain', nameEn: 'Bahrain' },
  { code: 'BD', name: 'Bangladesch', nameEn: 'Bangladesh' },
  { code: 'BB', name: 'Barbados', nameEn: 'Barbados' },
  { code: 'BY', name: 'Belarus', nameEn: 'Belarus' },
  { code: 'BE', name: 'Belgien', nameEn: 'Belgium' },
  { code: 'BZ', name: 'Belize', nameEn: 'Belize' },
  { code: 'BJ', name: 'Benin', nameEn: 'Benin' },
  { code: 'BT', name: 'Bhutan', nameEn: 'Bhutan' },
  { code: 'BO', name: 'Bolivien', nameEn: 'Bolivia' },
  { code: 'BA', name: 'Bosnien und Herzegowina', nameEn: 'Bosnia & Herzegovina' },
  { code: 'BW', name: 'Botsuana', nameEn: 'Botswana' },
  { code: 'BR', name: 'Brasilien', nameEn: 'Brazil' },
  { code: 'BN', name: 'Brunei', nameEn: 'Brunei' },
  { code: 'BG', name: 'Bulgarien', nameEn: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso', nameEn: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi', nameEn: 'Burundi' },
  { code: 'CV', name: 'Cabo Verde', nameEn: 'Cape Verde' },
  { code: 'CL', name: 'Chile', nameEn: 'Chile' },
  { code: 'CN', name: 'China', nameEn: 'China' },
  { code: 'CR', name: 'Costa Rica', nameEn: 'Costa Rica' },
  { code: 'CI', name: 'Côte d’Ivoire', nameEn: 'Côte d’Ivoire' },
  { code: 'DK', name: 'Dänemark', nameEn: 'Denmark' },
  { code: 'DE', name: 'Deutschland', nameEn: 'Germany' },
  { code: 'DM', name: 'Dominica', nameEn: 'Dominica' },
  { code: 'DO', name: 'Dominikanische Republik', nameEn: 'Dominican Republic' },
  { code: 'DJ', name: 'Dschibuti', nameEn: 'Djibouti' },
  { code: 'EC', name: 'Ecuador', nameEn: 'Ecuador' },
  { code: 'SV', name: 'El Salvador', nameEn: 'El Salvador' },
  { code: 'GB-ENG', name: 'England', nameEn: 'England' },
  { code: 'ER', name: 'Eritrea', nameEn: 'Eritrea' },
  { code: 'EE', name: 'Estland', nameEn: 'Estonia' },
  { code: 'SZ', name: 'Eswatini', nameEn: 'Eswatini' },
  { code: 'FJ', name: 'Fidschi', nameEn: 'Fiji' },
  { code: 'FI', name: 'Finnland', nameEn: 'Finland' },
  { code: 'FR', name: 'Frankreich', nameEn: 'France' },
  { code: 'GA', name: 'Gabun', nameEn: 'Gabon' },
  { code: 'GM', name: 'Gambia', nameEn: 'Gambia' },
  { code: 'GE', name: 'Georgien', nameEn: 'Georgia' },
  { code: 'GH', name: 'Ghana', nameEn: 'Ghana' },
  { code: 'GD', name: 'Grenada', nameEn: 'Grenada' },
  { code: 'GR', name: 'Griechenland', nameEn: 'Greece' },
  { code: 'GB', name: 'Großbritannien', nameEn: 'United Kingdom' },
  { code: 'GT', name: 'Guatemala', nameEn: 'Guatemala' },
  { code: 'GN', name: 'Guinea', nameEn: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau', nameEn: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana', nameEn: 'Guyana' },
  { code: 'HT', name: 'Haiti', nameEn: 'Haiti' },
  { code: 'HN', name: 'Honduras', nameEn: 'Honduras' },
  { code: 'HK', name: 'Hongkong', nameEn: 'Hong Kong SAR China' },
  { code: 'IN', name: 'Indien', nameEn: 'India' },
  { code: 'ID', name: 'Indonesien', nameEn: 'Indonesia' },
  { code: 'IQ', name: 'Irak', nameEn: 'Iraq' },
  { code: 'IR', name: 'Iran', nameEn: 'Iran' },
  { code: 'IE', name: 'Irland', nameEn: 'Ireland' },
  { code: 'IS', name: 'Island', nameEn: 'Iceland' },
  { code: 'IL', name: 'Israel', nameEn: 'Israel' },
  { code: 'IT', name: 'Italien', nameEn: 'Italy' },
  { code: 'JM', name: 'Jamaika', nameEn: 'Jamaica' },
  { code: 'JP', name: 'Japan', nameEn: 'Japan' },
  { code: 'YE', name: 'Jemen', nameEn: 'Yemen' },
  { code: 'JO', name: 'Jordanien', nameEn: 'Jordan' },
  { code: 'KH', name: 'Kambodscha', nameEn: 'Cambodia' },
  { code: 'CM', name: 'Kamerun', nameEn: 'Cameroon' },
  { code: 'CA', name: 'Kanada', nameEn: 'Canada' },
  { code: 'KZ', name: 'Kasachstan', nameEn: 'Kazakhstan' },
  { code: 'QA', name: 'Katar', nameEn: 'Qatar' },
  { code: 'KE', name: 'Kenia', nameEn: 'Kenya' },
  { code: 'KG', name: 'Kirgisistan', nameEn: 'Kyrgyzstan' },
  { code: 'KI', name: 'Kiribati', nameEn: 'Kiribati' },
  { code: 'CO', name: 'Kolumbien', nameEn: 'Colombia' },
  { code: 'KM', name: 'Komoren', nameEn: 'Comoros' },
  { code: 'CD', name: 'Kongo (Dem. Rep.)', nameEn: 'Congo - Kinshasa' },
  { code: 'CG', name: 'Kongo (Rep.)', nameEn: 'Congo - Brazzaville' },
  { code: 'XK', name: 'Kosovo', nameEn: 'Kosovo' },
  { code: 'HR', name: 'Kroatien', nameEn: 'Croatia' },
  { code: 'CU', name: 'Kuba', nameEn: 'Cuba' },
  { code: 'KW', name: 'Kuwait', nameEn: 'Kuwait' },
  { code: 'LA', name: 'Laos', nameEn: 'Laos' },
  { code: 'LS', name: 'Lesotho', nameEn: 'Lesotho' },
  { code: 'LV', name: 'Lettland', nameEn: 'Latvia' },
  { code: 'LB', name: 'Libanon', nameEn: 'Lebanon' },
  { code: 'LR', name: 'Liberia', nameEn: 'Liberia' },
  { code: 'LY', name: 'Libyen', nameEn: 'Libya' },
  { code: 'LI', name: 'Liechtenstein', nameEn: 'Liechtenstein' },
  { code: 'LT', name: 'Litauen', nameEn: 'Lithuania' },
  { code: 'LU', name: 'Luxemburg', nameEn: 'Luxembourg' },
  { code: 'MG', name: 'Madagaskar', nameEn: 'Madagascar' },
  { code: 'MW', name: 'Malawi', nameEn: 'Malawi' },
  { code: 'MY', name: 'Malaysia', nameEn: 'Malaysia' },
  { code: 'MV', name: 'Malediven', nameEn: 'Maldives' },
  { code: 'ML', name: 'Mali', nameEn: 'Mali' },
  { code: 'MT', name: 'Malta', nameEn: 'Malta' },
  { code: 'MA', name: 'Marokko', nameEn: 'Morocco' },
  { code: 'MH', name: 'Marshallinseln', nameEn: 'Marshall Islands' },
  { code: 'MR', name: 'Mauretanien', nameEn: 'Mauritania' },
  { code: 'MU', name: 'Mauritius', nameEn: 'Mauritius' },
  { code: 'MX', name: 'Mexiko', nameEn: 'Mexico' },
  { code: 'FM', name: 'Mikronesien', nameEn: 'Micronesia' },
  { code: 'MD', name: 'Moldau', nameEn: 'Moldova' },
  { code: 'MC', name: 'Monaco', nameEn: 'Monaco' },
  { code: 'MN', name: 'Mongolei', nameEn: 'Mongolia' },
  { code: 'ME', name: 'Montenegro', nameEn: 'Montenegro' },
  { code: 'MZ', name: 'Mosambik', nameEn: 'Mozambique' },
  { code: 'MM', name: 'Myanmar', nameEn: 'Myanmar (Burma)' },
  { code: 'NA', name: 'Namibia', nameEn: 'Namibia' },
  { code: 'NR', name: 'Nauru', nameEn: 'Nauru' },
  { code: 'NP', name: 'Nepal', nameEn: 'Nepal' },
  { code: 'NZ', name: 'Neuseeland', nameEn: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua', nameEn: 'Nicaragua' },
  { code: 'NL', name: 'Niederlande', nameEn: 'Netherlands' },
  { code: 'NE', name: 'Niger', nameEn: 'Niger' },
  { code: 'NG', name: 'Nigeria', nameEn: 'Nigeria' },
  { code: 'GB-NIR', name: 'Nordirland', nameEn: 'Northern Ireland' },
  { code: 'KP', name: 'Nordkorea', nameEn: 'North Korea' },
  { code: 'MK', name: 'Nordmazedonien', nameEn: 'North Macedonia' },
  { code: 'NO', name: 'Norwegen', nameEn: 'Norway' },
  { code: 'OM', name: 'Oman', nameEn: 'Oman' },
  { code: 'AT', name: 'Österreich', nameEn: 'Austria' },
  { code: 'PK', name: 'Pakistan', nameEn: 'Pakistan' },
  { code: 'PS', name: 'Palästina', nameEn: 'Palestinian Territories' },
  { code: 'PW', name: 'Palau', nameEn: 'Palau' },
  { code: 'PA', name: 'Panama', nameEn: 'Panama' },
  { code: 'PG', name: 'Papua-Neuguinea', nameEn: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay', nameEn: 'Paraguay' },
  { code: 'PE', name: 'Peru', nameEn: 'Peru' },
  { code: 'PH', name: 'Philippinen', nameEn: 'Philippines' },
  { code: 'PL', name: 'Polen', nameEn: 'Poland' },
  { code: 'PT', name: 'Portugal', nameEn: 'Portugal' },
  { code: 'PR', name: 'Puerto Rico', nameEn: 'Puerto Rico' },
  { code: 'RW', name: 'Ruanda', nameEn: 'Rwanda' },
  { code: 'RO', name: 'Rumänien', nameEn: 'Romania' },
  { code: 'RU', name: 'Russland', nameEn: 'Russia' },
  { code: 'SB', name: 'Salomonen', nameEn: 'Solomon Islands' },
  { code: 'ZM', name: 'Sambia', nameEn: 'Zambia' },
  { code: 'WS', name: 'Samoa', nameEn: 'Samoa' },
  { code: 'SM', name: 'San Marino', nameEn: 'San Marino' },
  { code: 'ST', name: 'São Tomé und Príncipe', nameEn: 'São Tomé & Príncipe' },
  { code: 'SA', name: 'Saudi-Arabien', nameEn: 'Saudi Arabia' },
  { code: 'GB-SCT', name: 'Schottland', nameEn: 'Scotland' },
  { code: 'SE', name: 'Schweden', nameEn: 'Sweden' },
  { code: 'CH', name: 'Schweiz', nameEn: 'Switzerland' },
  { code: 'SN', name: 'Senegal', nameEn: 'Senegal' },
  { code: 'RS', name: 'Serbien', nameEn: 'Serbia' },
  { code: 'SC', name: 'Seychellen', nameEn: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone', nameEn: 'Sierra Leone' },
  { code: 'ZW', name: 'Simbabwe', nameEn: 'Zimbabwe' },
  { code: 'SG', name: 'Singapur', nameEn: 'Singapore' },
  { code: 'SK', name: 'Slowakei', nameEn: 'Slovakia' },
  { code: 'SI', name: 'Slowenien', nameEn: 'Slovenia' },
  { code: 'SO', name: 'Somalia', nameEn: 'Somalia' },
  { code: 'ES', name: 'Spanien', nameEn: 'Spain' },
  { code: 'LK', name: 'Sri Lanka', nameEn: 'Sri Lanka' },
  { code: 'KN', name: 'St. Kitts und Nevis', nameEn: 'St. Kitts & Nevis' },
  { code: 'LC', name: 'St. Lucia', nameEn: 'St. Lucia' },
  { code: 'VC', name: 'St. Vincent und die Grenadinen', nameEn: 'St. Vincent & Grenadines' },
  { code: 'ZA', name: 'Südafrika', nameEn: 'South Africa' },
  { code: 'SD', name: 'Sudan', nameEn: 'Sudan' },
  { code: 'KR', name: 'Südkorea', nameEn: 'South Korea' },
  { code: 'SS', name: 'Südsudan', nameEn: 'South Sudan' },
  { code: 'SR', name: 'Suriname', nameEn: 'Suriname' },
  { code: 'SY', name: 'Syrien', nameEn: 'Syria' },
  { code: 'TJ', name: 'Tadschikistan', nameEn: 'Tajikistan' },
  { code: 'TW', name: 'Taiwan', nameEn: 'Taiwan' },
  { code: 'TZ', name: 'Tansania', nameEn: 'Tanzania' },
  { code: 'TH', name: 'Thailand', nameEn: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste', nameEn: 'Timor-Leste' },
  { code: 'TG', name: 'Togo', nameEn: 'Togo' },
  { code: 'TO', name: 'Tonga', nameEn: 'Tonga' },
  { code: 'TT', name: 'Trinidad und Tobago', nameEn: 'Trinidad & Tobago' },
  { code: 'TD', name: 'Tschad', nameEn: 'Chad' },
  { code: 'CZ', name: 'Tschechien', nameEn: 'Czechia' },
  { code: 'TN', name: 'Tunesien', nameEn: 'Tunisia' },
  { code: 'TR', name: 'Türkei', nameEn: 'Türkiye' },
  { code: 'TM', name: 'Turkmenistan', nameEn: 'Turkmenistan' },
  { code: 'TV', name: 'Tuvalu', nameEn: 'Tuvalu' },
  { code: 'UG', name: 'Uganda', nameEn: 'Uganda' },
  { code: 'UA', name: 'Ukraine', nameEn: 'Ukraine' },
  { code: 'HU', name: 'Ungarn', nameEn: 'Hungary' },
  { code: 'UY', name: 'Uruguay', nameEn: 'Uruguay' },
  { code: 'US', name: 'USA', nameEn: 'United States' },
  { code: 'UZ', name: 'Usbekistan', nameEn: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu', nameEn: 'Vanuatu' },
  { code: 'VA', name: 'Vatikanstadt', nameEn: 'Vatican City' },
  { code: 'VE', name: 'Venezuela', nameEn: 'Venezuela' },
  { code: 'AE', name: 'Vereinigte Arabische Emirate', nameEn: 'United Arab Emirates' },
  { code: 'VN', name: 'Vietnam', nameEn: 'Vietnam' },
  { code: 'GB-WLS', name: 'Wales', nameEn: 'Wales' },
  { code: 'CF', name: 'Zentralafrikanische Republik', nameEn: 'Central African Republic' },
  { code: 'CY', name: 'Zypern', nameEn: 'Cyprus' },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function countryByCode(code: string | null | undefined): Country | null {
  if (code === null || code === undefined) return null;
  return BY_CODE.get(code) ?? null;
}

// Lowercase, umlauts and accents folded, so "osterreich", "oesterreich" and
// "Österreich" all match.
export function normalizeCountryQuery(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim();
}

export function countryName(country: Country, language: AppLanguage): string {
  return language === 'en' ? country.nameEn : country.name;
}

const SEARCH_KEYS: Record<AppLanguage, Map<string, string>> = {
  de: new Map(COUNTRIES.map((c) => [c.code, normalizeCountryQuery(c.name)])),
  en: new Map(COUNTRIES.map((c) => [c.code, normalizeCountryQuery(c.nameEn)])),
};

const EN_SORTED: readonly Country[] = [...COUNTRIES].sort((a, b) => a.nameEn.localeCompare(b.nameEn, 'en'));

// Countries whose name (in the active language) contains the query, or whose
// code equals it; ordered alphabetically in that language.
export function searchCountries(query: string, language: AppLanguage = 'de'): readonly Country[] {
  const list = language === 'en' ? EN_SORTED : COUNTRIES;
  const q = normalizeCountryQuery(query);
  if (q.length === 0) return list;
  const keys = SEARCH_KEYS[language];
  return list.filter((c) => c.code.toLowerCase() === q || (keys.get(c.code) ?? '').includes(q));
}
