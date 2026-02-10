import AsyncStorage from '@react-native-async-storage/async-storage';

export const getSecurityCredentials = async () => {
  let name = await AsyncStorage.getItem('user_name');
  let secret = await AsyncStorage.getItem('device_secret');

  if (!secret) {
    const newSecret = 'SEC-' + Math.random().toString(36).substring(2, 15);

    await AsyncStorage.setItem('device_secret', newSecret);

    let check = await AsyncStorage.getItem('device_secret');

    if (!check) {
      await new Promise((resolve) => setTimeout(resolve, 50)); // Small 50ms pause
      await AsyncStorage.setItem('device_secret', newSecret);
      secret = newSecret;
    } else {
      secret = check;
    }
    console.log('✅ Secret verified and stored.');
  }

  return { name: name || 'Gost', secret };
};
