import type de from './de';
import type { LocaleShape } from './types';
import common from './en/common';
import auth from './en/auth';
import onboarding from './en/onboarding';
import settings from './en/settings';
import paywall from './en/paywall';
import legal from './en/legal';
import chat from './en/chat';
import notifications from './en/notifications';
import gym from './en/gym';
import venue from './en/venue';
import team from './en/team';
import profile from './en/profile';
import sparring from './en/sparring';
import sparringTrust from './en/sparringTrust';
import challenge from './en/challenge';
import home from './en/home';
import map from './en/map';

export type { LocaleShape } from './types';

const en: LocaleShape<typeof de> = {
  common,
  auth,
  onboarding,
  settings,
  paywall,
  legal,
  chat,
  notifications,
  gym,
  venue,
  team,
  profile,
  sparring,
  sparringTrust,
  challenge,
  home,
  map,
};

export default en;
