import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

// RevenueCat requires separate public API keys per platform.
// iOS key starts with "appl_", Android key starts with "goog_".
const API_KEY =
  Platform.OS === 'android'
    ? (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '')
    : (process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '');

export function configureRevenueCat(): void {
  if (API_KEY.length === 0) return;
  Purchases.configure({ apiKey: API_KEY });
}

export async function loginRevenueCat(userId: string): Promise<void> {
  await Purchases.logIn(userId);
}
