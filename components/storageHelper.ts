import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveWithExpiry = async (key: string, value: any, ttlMinutes: number) => {
  const now = new Date();
  const item = {
    value: value,
    expiry: now.getTime() + ttlMinutes * 60 * 1000, // Current time + X minutes
  };
  await AsyncStorage.setItem(key, JSON.stringify(item));
};

export const getWithExpiry = async (key: string) => {
  const itemStr = await AsyncStorage.getItem(key);
  if (!itemStr) return null;

  const item = JSON.parse(itemStr);
  const now = new Date();

  // Compare the expiry time with the current time
  if (now.getTime() > item.expiry) {
    // If expired, delete the item and return null
    await AsyncStorage.removeItem(key);
    return null;
  }
  return item.value;
};