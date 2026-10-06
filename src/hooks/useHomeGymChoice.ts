import { useState } from 'react';
import { Alert } from 'react-native';
import i18n from '../i18n';
import type { Gym } from './useGyms';
import type { ProfileUpdate } from '../types/database.types';

// "Hier trainiere ich" from a gym page: sets, switches or removes the single
// self-declared main gym (profiles.home_gym_id). Touches nothing else — no
// team membership (studio_id), request, booking or right on the gym.
export function useHomeGymChoice({ currentHomeGymId, currentHomeGymName, updateProfile, onChanged }: {
  currentHomeGymId:   string | null;
  currentHomeGymName: string | null;
  updateProfile:      (updates: ProfileUpdate) => Promise<{ error: string | null }>;
  onChanged:          () => void;
}): {
  busy:   boolean;
  choose: (gym: Pick<Gym, 'id' | 'name'>) => Promise<boolean>;
  remove: () => Promise<boolean>;
} {
  const [busy, setBusy] = useState(false);

  async function save(gymId: string | null): Promise<boolean> {
    setBusy(true);
    const { error } = await updateProfile({ home_gym_id: gymId });
    setBusy(false);
    if (error !== null) {
      Alert.alert(i18n.t('gym.homeChoice.saveFailedTitle'), i18n.t('gym.homeChoice.saveFailedBody'));
      return false;
    }
    onChanged();
    return true;
  }

  function confirm(title: string, message: string, label: string, destructive: boolean): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(title, message, [
        { text: i18n.t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: label, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) });
    });
  }

  async function choose(gym: Pick<Gym, 'id' | 'name'>): Promise<boolean> {
    if (gym.id === currentHomeGymId) return true;
    if (currentHomeGymId !== null) {
      const ok = await confirm(
        i18n.t('gym.homeChoice.switchTitle'),
        i18n.t('gym.homeChoice.switchBody', { current: currentHomeGymName ?? i18n.t('gym.homeChoice.otherGym'), next: gym.name }),
        i18n.t('gym.homeChoice.switchConfirm'),
        false,
      );
      if (!ok) return false;
    }
    return save(gym.id);
  }

  async function remove(): Promise<boolean> {
    if (currentHomeGymId === null) return true;
    const ok = await confirm(
      i18n.t('gym.homeChoice.removeTitle'),
      i18n.t('gym.homeChoice.removeBody'),
      i18n.t('common.remove'),
      true,
    );
    return ok ? save(null) : false;
  }

  return { busy, choose, remove };
}
