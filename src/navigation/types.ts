import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string };
};

export type SparringMapParams = {
  openCreate?: boolean;
  /** With openCreate: preselect this gym as the place (gym page "Sparring planen"). */
  createAtGymId?: string;
  focusSparringId?: string;
  /** With focusSparringId: opened from the intro; only a still joinable one shows. */
  focusFromIntro?: boolean;
  /** Set only by the intro hand-over: the target page may show its coach hint once. */
  introHint?: boolean;
  // Entry from the Home "near me" card: show sparrings in this radius with no
  // other filter. `nearbyEntryAt` makes a repeated tap a new request.
  nearbyRadiusKm?: number;
  nearbyEntryAt?: number;
  // First entry after the onboarding: the sparring map around the search
  // location just chosen. A new timestamp is a new request.
  searchEntryAt?: number;
  // Entry from the Home fight-night block: event map with watch parties for
  // this promotion (and, when known, this official fight night).
  watchEntryAt?: number;
  watchPromotion?: 'UFC' | 'OKTAGON';
  watchEventName?: string;
  /** First broadcast start of the fight night (ISO), if announced. */
  watchStart?: string;
  /** Venue-local event date "YYYY-MM-DD", if a fight night is known. */
  watchEventDate?: string;
} | undefined;

export type TabParamList = {
  Home: undefined;
  Karten: undefined;
  Sparring: SparringMapParams;
  Profil: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Settings: undefined;
  /** Optional intro again (settings): card and sparring step only. */
  Intro: undefined;
  Impressum: undefined;
  SparringRules: undefined;
  BlockedUsers: undefined;
  Paywall: { focus?: 'creator' | 'cards' } | undefined;
  SparringMap: SparringMapParams;
  PublicProfile: {
    userId:               string;
    sparringId?:          string;
    sparringScheduledAt?: string;
  };
  GymDetail: { gymId: string };
  GymEdit: { gymId: string };
  GymFighters: { gymId: string; gymName: string };
  VenueDetail: { venueId: string };
  // Legacy access for gym operators: running trial/contract/join requests.
  StudioRequests: { studioId: string };
  SparringChatList: undefined;
  SparringGroupChat: {
    sparringId:    string;
    sparringTitle: string;
    scheduledAt:   string;
    durationMin:   number;
    isOrganizer:   boolean;
  };
  EventGroupChat: {
    eventId:     string;
    eventTitle:  string;
    scheduledAt: string;
    durationMin: number;
    isOrganizer: boolean;
  };
  Notifications: undefined;
  SparringChallenge: undefined;
  EditProfile: undefined;
  Verification: undefined;
};
