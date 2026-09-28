import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMicrophonePermissions } from 'expo-camera';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getInvites, InviteItem, sendInvite } from '../../components/api';
import { USER_NAME_UPDATED_EVENT } from '../../components/events';
import { getSecurityCredentials } from '../../components/securityHelper';

const Glyphs = {
  camera: '\uf030',
  'clock-o': '\uf017',
  trophy: '\uf091',
  send: '\uf1d8',
};

type IconName = keyof typeof Glyphs;

const SHOW_VOICE_ROOM_LINK = false;

function TabBarIcon({ name, color, size = 28 }: { name: IconName; color: string; size?: number }) {
  return <Text style={[styles.iconText, { color, fontSize: size }]}>{Glyphs[name]}</Text>;
}

function BroadcastBanner() {
  const [latestInvite, setLatestInvite] = useState<InviteItem | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [isClient, setIsClient] = useState(false);

  const fetchInvites = async () => {
    try {
      const data = await getInvites();
      const newest = data[0];
      if (!newest) {
        setLatestInvite(null);
        return;
      }

      const msgTime = new Date(newest.timestamp).getTime();
      const diffHours = Math.abs(Date.now() - msgTime) / (1000 * 60 * 60);

      if (diffHours < 6) {
        setLatestInvite(newest);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      } else {
        setLatestInvite(null);
      }
    } catch {
      setLatestInvite(null);
    }
  };

  useEffect(() => {
    setIsClient(true);
    const initialDelay = setTimeout(fetchInvites, 1000);
    const interval = setInterval(fetchInvites, 30000);
    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  if (!isClient || !latestInvite) return null;

  return (
    <Animated.View style={[styles.banner, { opacity: fadeAnim }]}>
      <Text style={styles.bannerText} numberOfLines={1}>
        {latestInvite.type === 'Achievement' ? '🏆 ' : '🚀 '}
        <Text style={{ fontWeight: 'bold' }}>{latestInvite.sender}:</Text> {latestInvite.message}
      </Text>
    </Animated.View>
  );
}

export default function TabLayout() {
  const [userName, setUserName] = useState<string>('');
  const [isClient, setIsClient] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [msg, setMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [, requestMicPermission] = useMicrophonePermissions();

  const [fontsLoaded] = useFonts({
    LocalFontAwesome: require('../../assets/FontAwesome.ttf'),
  });

  const loadUserName = useCallback(async () => {
    try {
      const savedName = await AsyncStorage.getItem('user_name');
      if (savedName) setUserName(savedName);
    } catch {
      setUserName('');
    }
  }, []);

  useEffect(() => {
    setIsClient(true);
    loadUserName();
    const subscription = DeviceEventEmitter.addListener(USER_NAME_UPDATED_EVENT, (nextName) => {
      setUserName(String(nextName || ''));
    });
    return () => subscription.remove();
  }, [loadUserName]);

  const handleSendInvite = async () => {
    if (!msg.trim() || isSending) return;
    setIsSending(true);
    try {
      const { secret } = await getSecurityCredentials();
      await sendInvite(userName || 'Gost', secret, msg.trim());
      setMsg('');
      setModalVisible(false);
    } catch {
      // Keep this non-blocking; failed invites should not break navigation.
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenVoiceRoom = async () => {
    const nameParam = encodeURIComponent(userName || 'Gost');
    const url = `https://hairyploper.github.io/linkice/?name=${nameParam}`;
    requestMicPermission().catch(() => undefined);
    try {
      await Linking.openURL(url);
    } catch {
      // Link opening is best-effort on web/native.
    }
  };

  if (!isClient || !fontsLoaded) return null;

  const HeaderUserInfo = () => (
    <View style={styles.headerRightContainer}>
      {/* <TouchableOpacity
        accessibilityRole="button"
        onPress={() => setModalVisible(true)}
        style={styles.inviteIconBtn}
      >
        <TabBarIcon name="send" color="#2196F3" size={17} />
      </TouchableOpacity> */}
      {SHOW_VOICE_ROOM_LINK && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleOpenVoiceRoom}
          style={styles.inviteIconBtn}
        >
          <Text style={{ fontSize: 20 }}>🔗</Text>
        </TouchableOpacity>
      )}
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.brandText}>ŠMIBER</Text>
        <Text style={styles.userSubText}>{userName || 'Gost'}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* <BroadcastBanner /> */}
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#2196F3',
          headerShown: true,
          headerTitle: () => null,
          headerRight: () => <HeaderUserInfo />,
          tabBarStyle: { height: 55 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Skeniraj',
            tabBarIcon: ({ color }) => <TabBarIcon name="camera" color={color} />,
          }}
        />
        <Tabs.Screen
          name="UserHistory"
          options={{
            title: 'Pregled',
            tabBarIcon: ({ color }) => <TabBarIcon name="clock-o" color={color} />,
          }}
        />
        <Tabs.Screen
          name="Leaderboard"
          options={{
            title: 'Rang lista',
            tabBarIcon: ({ color }) => <TabBarIcon name="trophy" color={color} />,
          }}
        />
      </Tabs>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Poruka</Text>
            <TextInput
              style={styles.input}
              placeholder="Napiši poruku..."
              value={msg}
              onChangeText={setMsg}
              editable={!isSending}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} disabled={isSending}>
                <Text style={{ color: isSending ? '#ccc' : 'red' }}>Otkaži</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendInvite} disabled={isSending}>
                <Text style={{ color: isSending ? '#aaa' : '#2196F3', fontWeight: 'bold' }}>
                  {isSending ? 'Slanje...' : 'Pošalji'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  iconText: { fontFamily: 'LocalFontAwesome', textAlign: 'center' },
  headerRightContainer: { marginRight: 15, flexDirection: 'row', alignItems: 'center' },
  inviteIconBtn: { marginRight: 5, padding: 0 },
  brandText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#2196F3',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  userSubText: { fontSize: 14, fontWeight: '700', color: '#333' },
  banner: {
    backgroundColor: '#E3F2FD',
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  bannerText: { textAlign: 'center', color: '#0D47A1', fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 30,
  },
  modalContent: { backgroundColor: 'white', borderRadius: 15, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
});
