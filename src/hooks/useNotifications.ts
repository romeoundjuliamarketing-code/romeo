import { useCallback, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { StudioSchedule } from '../types/database.types';

// Push tokens only work on physical devices with APNs configured
const IS_REAL_DEVICE = Constants.isDevice === true && Platform.OS !== 'web';

const PROJECT_ID = '9811826e-5835-47ff-9c96-8fb7a14cdab3';
const SETUP_KEY = 'notifications_setup_v1';

// Fallback weight used when the user has no weight log entry yet
const FALLBACK_WEIGHT_KG = 75;

// Configure how notifications are shown while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function savePushToken(token: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user === null) return;
  await supabase.from('profiles').update({ expo_push_token: token }).eq('id', user.id);
}

// Randomised message pools — a new body is selected each time notifications are scheduled
const WATER_BODIES: readonly string[] = [
  'Wasser trinken — dein Körper dankt es dir.',
  'Hydration-Check: Wann hast du zuletzt getrunken?',
  'Kurze Pause. Glas Wasser. Weiter.',
  'Genug getrunken heute? Jetzt wäre ein guter Moment.',
  'Wasser ist kein Lifestyle, es ist Leistung.',
  'Trink jetzt — warte nicht bis du Durst hast.',
  'Ein Glas Wasser, direkt jetzt.',
  'Dein Fokus hängt auch davon ab, wie gut du hydriert bist.',
];

const WEIGHT_BODIES: readonly string[] = [
  'Wöchentliches Wiegen — nur eine Zahl, aber sie zeigt den Trend.',
  'Montag, neues Gewicht. Kurz auf die Waage und eintragen.',
  'Check-in Zeit: Wie hat sich die Woche auf der Waage bemerkbar gemacht?',
  'Gewicht eintragen — damit der Coach-Algorithmus für dich arbeiten kann.',
  'Eine Messung pro Woche reicht. Jetzt wäre der Moment.',
];

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

async function scheduleRepeatingNotifications(): Promise<void> {
  const repeatingIds = ['water-9', 'water-13', 'water-17', 'weight-monday'];
  await Promise.all(repeatingIds.map((id) =>
    Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
  ));

  const waterTimes = [
    { id: 'water-9',  hour: 9  },
    { id: 'water-13', hour: 13 },
    { id: 'water-17', hour: 17 },
  ];
  for (const { id, hour } of waterTimes) {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title: 'Wasser trinken', body: pickRandom(WATER_BODIES) },
      trigger: { type: SchedulableTriggerInputTypes.DAILY, hour, minute: 0 },
    });
  }

  // weekday: 2 = Monday (Sunday = 1)
  await Notifications.scheduleNotificationAsync({
    identifier: 'weight-monday',
    content: {
      title: 'Wöchentliches Gewichts-Check-in',
      body: pickRandom(WEIGHT_BODIES),
    },
    trigger: { type: SchedulableTriggerInputTypes.WEEKLY, weekday: 2, hour: 8, minute: 0 },
  });
}

// ─── Pre-Workout ──────────────────────────────────────────────────────────────

interface PreWorkoutValues {
  carbsGrams: number;
  proteinGrams: number;
  quickCarbsGrams: number;
  waterMl: number;
}

function calcPreWorkoutValues(weightKg: number): PreWorkoutValues {
  return {
    carbsGrams: Math.round(weightKg * 1.2),
    proteinGrams: Math.round(weightKg * 0.35),
    quickCarbsGrams: Math.round(weightKg * 0.5),
    waterMl: Math.round((weightKg * 6) / 50) * 50,
  };
}

async function schedulePreWorkoutNotifications(
  sessions: StudioSchedule[],
  now: Date,
): Promise<void> {
  // Load most recent weight log for personalised notification content
  const { data: { user } } = await supabase.auth.getUser();
  const weightEntry = user !== null
    ? await supabase
        .from('weight_logs')
        .select('weight_kg')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle()
    : null;

  const rawWeight = weightEntry?.data?.weight_kg;
  const weightKg: number = typeof rawWeight === 'number' ? rawWeight : FALLBACK_WEIGHT_KG;
  const { carbsGrams, proteinGrams, quickCarbsGrams, waterMl } = calcPreWorkoutValues(weightKg);

  const offsets: Array<{
    minutesBefore: number;
    idPrefix: string;
    title: string;
    body: string;
  }> = [
    {
      minutesBefore: 240,
      idPrefix: 'preworkout-4h',
      title: 'Heute Training: Ernährung',
      body: 'Jetzt vollständig essen — letzte Mahlzeit mit Fetten und Ballaststoffen. Danach nur noch leichte Kost.',
    },
    {
      minutesBefore: 120,
      idPrefix: 'preworkout-2h',
      title: 'Trainingszeit nähert sich',
      body: `Leichte Mahlzeit: ~${carbsGrams} g Kohlenhydrate + ~${proteinGrams} g Protein. Z.B. Reis + Hühnchen.`,
    },
    {
      minutesBefore: 60,
      idPrefix: 'preworkout-1h',
      title: '1 Stunde bis Training',
      body: `Kleiner Snack: ~${quickCarbsGrams} g schnelle Carbs (Banane, Reiswaffel). Dazu ${waterMl} ml Wasser mit einer Prise Salz.`,
    },
    {
      minutesBefore: 30,
      idPrefix: 'preworkout-30min',
      title: '30 Minuten',
      body: 'Kein Essen mehr. Equipment packen, kurz dehnen, mental einstimmen.',
    },
  ];

  for (const session of sessions) {
    const parts = session.start_time.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    for (const offset of offsets) {
      const triggerTime = new Date();
      triggerTime.setHours(h, m - offset.minutesBefore, 0, 0);
      if (triggerTime <= now) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${offset.idPrefix}-${session.id}`,
        content: { title: offset.title, body: offset.body },
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: triggerTime },
      });
    }
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications(): {
  scheduleTrainingReminders: (sessions: StudioSchedule[], preWorkoutEnabled: boolean) => Promise<void>;
} {
  useEffect(() => {
    void (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      // Push tokens only available on real devices with APNs configured
      if (IS_REAL_DEVICE) {
        try {
          const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
          await savePushToken(token);
        } catch {
          // missing APNs entitlement or EAS credentials — silently skip
        }
      }

      // Schedule water + weight repeating notifications once per install
      const alreadySetup = await AsyncStorage.getItem(SETUP_KEY);
      if (alreadySetup !== 'true') {
        await scheduleRepeatingNotifications();
        await AsyncStorage.setItem(SETUP_KEY, 'true');
      }
    })();
  }, []);

  const scheduleTrainingReminders = useCallback(async (
    sessions: StudioSchedule[],
    preWorkoutEnabled: boolean,
  ): Promise<void> => {
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      allScheduled
        .filter((n) =>
          n.identifier.startsWith('training-') || n.identifier.startsWith('preworkout-'),
        )
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );

    // Only schedule notifications for sessions the user has confirmed participation in
    const { data: { user } } = await supabase.auth.getUser();
    let confirmedIds = new Set<string>();
    if (user !== null) {
      const todayIso = new Date().toISOString().split('T')[0];
      const { data: participationData } = await supabase
        .from('schedule_participations')
        .select('schedule_id')
        .eq('user_id', user.id)
        .eq('session_date', todayIso);
      confirmedIds = new Set((participationData ?? []).map((p) => p.schedule_id));
    }
    const confirmedSessions = sessions.filter((s) => confirmedIds.has(s.id));

    const pointsReminders = [
      'Dein Training startet bald — vergiss nicht, dich anzumelden und deine Punkte abzuholen!',
      'Noch 1 Stunde bis zum Training. Bist du dabei? Dann sicher dir deine Punkte!',
      'Training in 1 Stunde — zeig auf der Matte und kassier deine Punkte!',
      'Gleich gehts los! Meld dich fürs Training an und streich die Punkte ein.',
      '1 Stunde noch — dann Punkte sammeln nicht vergessen!',
      'Dein nächstes Training steht an. Dabei sein lohnt sich — Punkte warten auf dich!',
    ];

    const now = new Date();

    if (!preWorkoutEnabled) {
      // Standard mode: schedule 1h points-reminder for each confirmed session
      for (const session of confirmedSessions) {
        const parts = session.start_time.split(':');
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const reminderTime = new Date();
        reminderTime.setHours(h - 1, m, 0, 0);
        if (reminderTime <= now) continue;

        const body = pointsReminders[Math.floor(Math.random() * pointsReminders.length)] as string;
        await Notifications.scheduleNotificationAsync({
          identifier: `training-${session.id}`,
          content: { title: 'Training in 1 Stunde', body },
          trigger: { type: SchedulableTriggerInputTypes.DATE, date: reminderTime },
        });
      }
    } else {
      // Pre-workout mode: 4-step preparation chain replaces the T-1h points reminder
      await schedulePreWorkoutNotifications(confirmedSessions, now);
    }
  }, []);

  return { scheduleTrainingReminders };
}
