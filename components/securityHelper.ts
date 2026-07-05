import AsyncStorage from '@react-native-async-storage/async-storage';

function createDeviceSecret(): string {
  const bytes = new Uint8Array(16);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return `SEC-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }

  return `SEC-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 12)}`;
}

export const getSecurityCredentials = async () => {
  const name = await AsyncStorage.getItem('user_name');
  let secret = await AsyncStorage.getItem('device_secret');

  if (!secret) {
    const newSecret = createDeviceSecret();
    await AsyncStorage.setItem('device_secret', newSecret);

    const check = await AsyncStorage.getItem('device_secret');

    if (!check) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      await AsyncStorage.setItem('device_secret', newSecret);
      secret = newSecret;
    } else {
      secret = check;
    }
  }

  return { name: name || 'Gost', secret };
};
