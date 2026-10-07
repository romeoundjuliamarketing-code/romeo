import { announcementPushMessages } from './announcementPush';

describe('announcementPushMessages', () => {
  it('titles each push in the recipient language, German when unset', () => {
    const msgs = announcementPushMessages([
      { expo_push_token: 'a', language: 'en' },
      { expo_push_token: 'b', language: 'de' },
      { expo_push_token: 'c', language: null },
    ], 'Training fällt aus');
    expect(msgs.map((m) => [m.to, m.title, m.body])).toEqual([
      ['a', 'Announcement from your coach', 'Training fällt aus'],
      ['b', 'Ankündigung vom Trainer', 'Training fällt aus'],
      ['c', 'Ankündigung vom Trainer', 'Training fällt aus'],
    ]);
  });
  it('skips members without a token', () => {
    expect(announcementPushMessages([{ expo_push_token: null, language: 'en' }, { expo_push_token: '', language: 'de' }], 'x')).toEqual([]);
  });
});
