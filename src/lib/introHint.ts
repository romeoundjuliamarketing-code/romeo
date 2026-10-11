import AsyncStorage from '@react-native-async-storage/async-storage';

// Per account on this device: the coach hint after the intro was really
// shown once. The automatic intro hand-over happens once per account anyway
// (its end is saved on the server); this only keeps a replay from the
// settings from showing the hint again.
const key = (userId: string): string => `sparr.introArrivalHint.v1:${userId}`;

export async function isIntroHintSeen(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(userId))) === '1';
  } catch {
    // Unreadable storage: the hint shows; it never blocks anything.
    return false;
  }
}

export function markIntroHintSeen(userId: string): void {
  AsyncStorage.setItem(key(userId), '1').catch(() => undefined);
}
