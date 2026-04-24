import Purchases from 'react-native-purchases';

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';

export function configureRevenueCat(): void {
  if (API_KEY.length === 0) return;
  Purchases.configure({ apiKey: API_KEY });
}

export function loginRevenueCat(userId: string): void {
  void Purchases.logIn(userId);
}
