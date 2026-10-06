import type de from '../de/legal';
import type { LocaleShape } from '../types';

const legal: LocaleShape<typeof de> = {
  imprint: {
    title: 'Legal notice',
    section5: 'Information pursuant to Section 5 DDG (German Digital Services Act)',
    country: 'Germany',
    contact: 'Contact',
    responsible: 'Responsible for content pursuant to Section 18 (2) MStV (German Interstate Media Treaty)',
    dispute: 'Consumer dispute resolution',
    disputeText: 'We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.',
  },
};

export default legal;
