// Source of truth for all translation keys, one file per area in ./de/.
// en.ts must mirror this shape.
import common from './de/common';
import auth from './de/auth';
import onboarding from './de/onboarding';
import settings from './de/settings';
import paywall from './de/paywall';
import legal from './de/legal';
import chat from './de/chat';
import notifications from './de/notifications';
import gym from './de/gym';
import venue from './de/venue';
import team from './de/team';
import profile from './de/profile';
import sparring from './de/sparring';
import challenge from './de/challenge';
import home from './de/home';
import map from './de/map';

const de = {
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
  challenge,
  home,
  map,
} as const;

export default de;
