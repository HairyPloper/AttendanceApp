import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEnvelope<T> {
  value: T;
  expiry: number;
}

export const CACHE_KEYS = {
  eventList: 'cached_event_list',
  leaderboard: (eventName: string) => `cached_leaderboard_${eventName || 'Ukupno'}`,
  history: (name: string) => `cache_history_${name.trim()}`,
};

export function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isCacheEnvelope<T>(value: unknown): value is CacheEnvelope<T> {
  return (
    !!value &&
    typeof value === 'object' &&
    'value' in value &&
    'expiry' in value &&
    typeof (value as CacheEnvelope<T>).expiry === 'number'
  );
}

export const saveWithExpiry = async <T>(key: string, value: T, ttlMinutes: number) => {
  const now = new Date();
  const item: CacheEnvelope<T> = {
    value,
    expiry: now.getTime() + ttlMinutes * 60 * 1000,
  };
  await AsyncStorage.setItem(key, JSON.stringify(item));
};

export const getWithExpiry = async <T>(key: string): Promise<T | null> => {
  const itemStr = await AsyncStorage.getItem(key);
  if (!itemStr) return null;

  const item = safeJsonParse<CacheEnvelope<T> | T | null>(itemStr, null);
  if (!item) {
    await AsyncStorage.removeItem(key);
    return null;
  }

  if (!isCacheEnvelope<T>(item)) {
    return item as T;
  }

  const now = new Date();

  if (now.getTime() > item.expiry) {
    await AsyncStorage.removeItem(key);
    return null;
  }

  return item.value;
};

export const invalidateAttendanceCaches = async (name: string) => {
  await AsyncStorage.multiRemove([
    CACHE_KEYS.history(name),
    CACHE_KEYS.eventList,
    CACHE_KEYS.leaderboard('Ukupno'),
  ]);
};
