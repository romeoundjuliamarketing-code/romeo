// Team announcements are pushed from the coach's device straight to the
// members. The title follows each recipient's profiles.language (NULL = German),
// not the coach's app language; the message itself is user content.
import i18n from '../i18n';
import { parseLanguage } from './language';

export interface AnnouncementRecipient {
  expo_push_token: string | null;
  language:        string | null;
}

export interface AnnouncementPushMessage {
  to:    string;
  title: string;
  body:  string;
  sound: 'default';
}

export function announcementPushMessages(
  members: readonly AnnouncementRecipient[],
  message: string,
): AnnouncementPushMessage[] {
  return members.flatMap((m) => {
    if (m.expo_push_token === null || m.expo_push_token.length === 0) return [];
    const t = i18n.getFixedT(parseLanguage(m.language) ?? 'de');
    return [{ to: m.expo_push_token, title: t('home.screen.announcementPushTitle'), body: message, sound: 'default' as const }];
  });
}
