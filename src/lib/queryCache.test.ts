jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCached, setCached, clearQueryCache, flushQueryCache, hydrateQueryCache } from './queryCache';

describe('queryCache', () => {
  beforeEach(async () => {
    clearQueryCache();
    // Give any pending timers a chance to be cleared, then reset the mock
    await flushQueryCache();
    jest.clearAllMocks();
  });

  it('returns undefined for a key that was never set', () => {
    const result = getCached<string>('missing-key');
    expect(result).toBeUndefined();
  });

  it('set/get round-trip returns the stored value', () => {
    setCached<number>('my-key', 42);
    expect(getCached<number>('my-key')).toBe(42);
  });

  it('handles object values with generics', () => {
    const value = { profile: { id: 'abc', name: 'Romeo' } };
    setCached('profile:abc', value);
    const result = getCached<typeof value>('profile:abc');
    expect(result).toEqual(value);
  });

  it('overwrites existing value on second set', () => {
    setCached<string>('key', 'first');
    setCached<string>('key', 'second');
    expect(getCached<string>('key')).toBe('second');
  });

  it('clearQueryCache removes all entries', () => {
    setCached<number>('a', 1);
    setCached<number>('b', 2);
    clearQueryCache();
    expect(getCached<number>('a')).toBeUndefined();
    expect(getCached<number>('b')).toBeUndefined();
  });

  it('different keys are independent', () => {
    setCached<string>('x', 'hello');
    setCached<string>('y', 'world');
    expect(getCached<string>('x')).toBe('hello');
    expect(getCached<string>('y')).toBe('world');
  });
});

describe('queryCache persistence', () => {
  const STORAGE_KEY = 'query_cache_v1' as const;

  beforeEach(async () => {
    clearQueryCache();
    await flushQueryCache();
    jest.clearAllMocks();
  });

  it('setCached + flushQueryCache writes the entry to AsyncStorage', async () => {
    setCached<number>('persist-key', 99);
    await flushQueryCache();

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const entries = JSON.parse(raw as string) as [string, unknown][];
    const found = entries.find(([k]) => k === 'persist-key');
    expect(found).toBeDefined();
    expect(found?.[1]).toBe(99);
  });

  it('hydrateQueryCache restores an entry that was previously persisted', async () => {
    // Write a value and flush it to the mock storage
    setCached<string>('hydrate-key', 'restored-value');
    await flushQueryCache();

    // Wipe the in-memory store without touching storage
    clearQueryCache();
    // clearQueryCache also calls removeItem; we need to re-seed the storage manually
    // so hydrateQueryCache has something to read
    const payload = JSON.stringify([['hydrate-key', 'restored-value']]);
    await AsyncStorage.setItem(STORAGE_KEY, payload);

    // Now hydrate — the in-memory store is empty, so the entry should be restored
    await hydrateQueryCache();
    expect(getCached<string>('hydrate-key')).toBe('restored-value');
  });

  it('clearQueryCache calls AsyncStorage.removeItem and leaves nothing in storage', async () => {
    setCached<number>('to-be-cleared', 7);
    await flushQueryCache();

    clearQueryCache();

    // The removeItem should have been called during clearQueryCache
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    // In-memory store is empty
    expect(getCached<number>('to-be-cleared')).toBeUndefined();
  });
});
