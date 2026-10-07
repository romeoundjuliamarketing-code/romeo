-- One-off: notifications of recipients who chose English. Titles map by type;
-- bodies of the simple types are rebuilt from their fixed German pattern
-- (default sparring titles translated), everything else stays as stored.
WITH en AS (SELECT id FROM profiles WHERE language = 'en'),
src AS (
  SELECT n.id, n.type, n.body, n.data,
         regexp_match(n.body, '^(.+) hat sich für „(.+)“ angemeldet\.$')        AS m_signup,
         regexp_match(n.body, '^(.+) hat sich von „(.+)“ abgemeldet\.$')        AS m_withdraw,
         regexp_match(n.body, '^"(.+)" wurde vom Organisator abgesagt\.$')      AS m_cancel,
         regexp_match(n.body, '^(.+) hat sich für "(.+)" angemeldet\.$')        AS m_event,
         regexp_match(n.body, '^(.+) möchte deinem Team beitreten\.$')          AS m_join,
         regexp_match(n.body, '^Deine Mitgliedschaft bei (.+) ist aktiv\.$')    AS m_active,
         regexp_match(n.body, '^Deine Mitgliedschaft bei (.+) wurde beendet\.$') AS m_ended,
         regexp_match(n.body, '^(.+) hat die Mitgliedschaft gekündigt\.$')      AS m_quit
  FROM notifications n JOIN en ON en.id = n.user_id
)
UPDATE notifications n SET
  title = CASE s.type
    WHEN 'sparring_signup'              THEN 'New sparring sign-up'
    WHEN 'sparring_signup_cancelled'    THEN 'Participant withdrew'
    WHEN 'sparring_cancelled'           THEN 'Sparring cancelled'
    WHEN 'event_signup'                 THEN 'New event sign-up'
    WHEN 'event_cancelled'              THEN 'Event cancelled'
    WHEN 'studio_join_request'          THEN 'New join request'
    WHEN 'membership_requested'         THEN 'New membership request'
    WHEN 'membership_confirmed'         THEN 'Membership confirmed'
    WHEN 'membership_declined'          THEN 'Membership request declined'
    WHEN 'membership_ended'             THEN 'Membership ended'
    WHEN 'cancellation_requested'       THEN 'Cancellation received'
    WHEN 'sparring_waitlist_promoted'   THEN 'A spot opened up'
    WHEN 'sparring_slot_expired'        THEN 'Your spot was released'
    WHEN 'sparring_confirm_7d'          THEN 'Are you still in?'
    WHEN 'sparring_confirm_24h'         THEN 'Are you in?'
    WHEN 'sparring_reminder_3h'         THEN 'Starting soon'
    WHEN 'sparring_attendance_reminder' THEN 'Who was there?'
    WHEN 'sparring_updated'             THEN 'Sparring changed'
    WHEN 'studio_join_response'         THEN CASE WHEN (s.data->>'approved')::boolean THEN 'Join confirmed' ELSE 'Join declined' END
    ELSE n.title END,
  body = CASE
    WHEN s.type = 'sparring_signup' AND s.m_signup IS NOT NULL
      THEN s.m_signup[1] || ' signed up for “' || sparring_title_for(s.m_signup[2], 'en') || '”.'
    WHEN s.type = 'sparring_signup_cancelled' AND s.m_withdraw IS NOT NULL
      THEN s.m_withdraw[1] || ' withdrew from “' || sparring_title_for(s.m_withdraw[2], 'en') || '”.'
    WHEN s.type = 'sparring_cancelled' AND s.m_cancel IS NOT NULL
      THEN '“' || sparring_title_for(s.m_cancel[1], 'en') || '” was cancelled by the organiser.'
    WHEN s.type = 'event_signup' AND s.m_event IS NOT NULL
      THEN s.m_event[1] || ' signed up for "' || s.m_event[2] || '".'
    WHEN s.type = 'studio_join_request' AND s.m_join IS NOT NULL
      THEN s.m_join[1] || ' would like to join your team.'
    WHEN s.type = 'membership_confirmed' AND s.m_active IS NOT NULL
      THEN 'Your membership at ' || s.m_active[1] || ' is active.'
    WHEN s.type = 'membership_ended' AND s.m_ended IS NOT NULL
      THEN 'Your membership at ' || s.m_ended[1] || ' has ended.'
    WHEN s.type = 'cancellation_requested' AND s.m_quit IS NOT NULL
      THEN s.m_quit[1] || ' cancelled the membership.'
    ELSE n.body END
FROM src s WHERE n.id = s.id;
