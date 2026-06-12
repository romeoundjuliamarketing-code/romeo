// Module-level in-memory cache for hook query results.
// Survives screen unmount/remount within a session, enabling
// stale-while-revalidate so re-focusing a screen shows data instantly.
// Values are also persisted to AsyncStorage so they survive app restarts.
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'query_cache_v1';

const store = new Map<string, unknown>();

// Debounce timer handle — cleared and reset on every setCached call
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function getCached<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  store.set(key, value);
  // Debounce: wait 500 ms after the last write before persisting
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { void persist(); }, 500);
}

// Serialises the in-memory store to AsyncStorage.
async function persist(): Promise<void> {
  persistTimer = null;
  try {
    const json = JSON.stringify(Array.from(store.entries()));
    await AsyncStorage.setItem(STORAGE_KEY, json);
  } catch {
    // Persist is best-effort — never block or throw
  }
}

// Forces an immediate persist, bypassing the debounce timer.
// Useful in tests that need the write to be flushed synchronously.
export async function flushQueryCache(): Promise<void> {
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  await persist();
}

// Reads the previously persisted cache from AsyncStorage and populates
// the in-memory store. Entries that are already in memory are NOT
// overwritten (in-session writes always win).
export async function hydrateQueryCache(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return;
    const entries = JSON.parse(raw) as [string, unknown][];
    for (const [k, v] of entries) {
      if (!store.has(k)) store.set(k, v);
    }
  } catch {
    // Hydration failure is non-fatal — cache stays empty
  }
}

// Clears everything — call on sign-out / user switch to avoid leaking
// one account's data into another.
export function clearQueryCache(): void {
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  store.clear();
  void AsyncStorage.removeItem(STORAGE_KEY);
}
