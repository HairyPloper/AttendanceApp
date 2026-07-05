import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMicrophonePermissions } from 'expo-camera';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Easing,
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

function TabBarIcon({ name, color, size = 28 }: { name: IconName; color: string; size?: number }) {
  return <Text style={[styles.iconText, { color, fontSize: size }]}>{Glyphs[name]}</Text>;
}

function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    expired: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

  const moveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const calculateTimeLeft = () => {
      const targetDate = new Date('2026-09-12T00:00:00+02:00');
      const difference = targetDate.getTime() - Date.now();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
          expired: false,
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isActive = true;

    const runConveyorBelt = () => {
      if (!isActive || timeLeft.expired) return;

      moveAnim.setValue(0);
      Animated.timing(moveAnim, {
        toValue: 22,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && isActive) runConveyorBelt();
      });
    };

    if (!timeLeft.expired) {
      runConveyorBelt();
    } else {
      moveAnim.setValue(0);
    }

    return () => {
      isActive = false;
      moveAnim.stopAnimation();
    };
  }, [timeLeft.expired, moveAnim]);

  return (
    <View style={styles.countdownContainer}>
      {!timeLeft.expired && <Text style={{ fontSize: 18 }}>👷‍♂️</Text>}
      {!timeLeft.expired && (
        <View style={styles.conveyorBeltClip}>
          <Animated.View style={[styles.conveyorBelt, { transform: [{ translateX: moveAnim }] }]}>
            <Text style={styles.box}>📦</Text>
            <Text style={styles.box}>📦</Text>
            <Text style={styles.box}>📦</Text>
          </Animated.View>
        </View>
      )}
      <Text style={styles.factoryWorker}>{timeLeft.expired ? '' : '🏭'}</Text>
      <View style={styles.countdownTextContainer}>
        {timeLeft.expired ? (
          <Text style={styles.vacationText}>🏖️ Kalimera - nema više menadžera!</Text>
        ) : (
          <>
            <Text style={styles.countdownLabel}>radi se još...</Text>
            <Text style={styles.countdownTime}>
              {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

function HeaderTitle({ iconName }: { iconName: IconName }) {
  return (
    <View style={styles.headerTitleContainer}>
      <TabBarIcon name={iconName} color="#666" size={24} />
      <CountdownTimer />
    </View>
  );
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
      <TouchableOpacity
        accessibilityRole="button"
        onPress={handleOpenVoiceRoom}
        style={styles.inviteIconBtn}
      >
        <Text style={{ fontSize: 20 }}>🔗</Text>
      </TouchableOpacity>
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
          headerRight: () => <HeaderUserInfo />,
          tabBarStyle: { height: 55 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Skeniraj',
            headerTitle: () => <HeaderTitle iconName="camera" />,
            tabBarIcon: ({ color }) => <TabBarIcon name="camera" color={color} />,
          }}
        />
        <Tabs.Screen
          name="UserHistory"
          options={{
            title: 'Pregled',
            headerTitle: () => <HeaderTitle iconName="clock-o" />,
            tabBarIcon: ({ color }) => <TabBarIcon name="clock-o" color={color} />,
          }}
        />
        <Tabs.Screen
          name="Leaderboard"
          options={{
            title: 'Rang lista',
            headerTitle: () => <HeaderTitle iconName="trophy" />,
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
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 15,
    maxWidth: 230,
  },
  factoryWorker: {
    fontSize: 18,
    zIndex: 2,
    marginRight: 8,
  },
  conveyorBeltClip: {
    width: 50,
    overflow: 'hidden',
    marginHorizontal: 2,
    marginLeft: -4,
    marginRight: -4,
  },
  conveyorBelt: {
    flexDirection: 'row',
    gap: 11,
  },
  box: {
    fontSize: 10,
  },
  countdownTextContainer: {
    justifyContent: 'center',
    minWidth: 118,
  },
  countdownLabel: {
    fontSize: 12,
    color: '#F57C00',
    fontWeight: '900',
  },
  countdownTime: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#E65100',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  vacationText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#00897B',
  },
});
