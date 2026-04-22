import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMicrophonePermissions } from 'expo-camera';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
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
import { getSecurityCredentials } from '../../components/securityHelper';

const API_URL = 'api_url_go';

const Glyphs = {
  camera: '\uf030',
  'clock-o': '\uf017',
  trophy: '\uf091',
  send: '\uf1d8',
};

type IconName = keyof typeof Glyphs;

function TabBarIcon({ name, color, size = 28 }: { name: IconName; color: string; size?: number }) {
  return <Text style={[styles.iconText, { color: color, fontSize: size }]}>{Glyphs[name]}</Text>;
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

  // 1. Clock Logic
  useEffect(() => {
    const calculateTimeLeft = () => {
      // September 12, 2026 at 00:00 Belgrade time (UTC+2 in summer)
      const targetDate = new Date('2026-09-12T00:00:00+02:00');
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

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
        if (finished && isActive) {
          runConveyorBelt();
        }
      });
    };

    if (!timeLeft.expired) {
      runConveyorBelt();
    } else {
      moveAnim.setValue(0);
    }

    // Cleanup
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
          <Text style={styles.vacationText}>🏖️Kalimera-nema više menadžera!</Text>
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
  const [latestInvite, setLatestInvite] = useState<any>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [isClient, setIsClient] = useState(false);

  const fetchInvites = async () => {
    try {
      const res = await fetch(`${API_URL}?action=getInvites&t=${Date.now()}`, {
        method: 'GET',
        mode: 'cors',
        redirect: 'follow',
      });

      if (!res.ok) throw new Error('Network response not ok');

      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const newest = data[0];
        const msgTime = new Date(newest.timestamp).getTime();
        const now = new Date().getTime();
        const diffHours = Math.abs(now - msgTime) / (1000 * 60 * 60);

        const isRecentInvite = diffHours < 6;

        if (isRecentInvite) {
          setLatestInvite(newest);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        } else {
          setLatestInvite(null);
        }
      }
    } catch (e) {
      console.warn('Banner fetch suppressed: Network warming up...');
    }
  };

  useEffect(() => {
    setIsClient(true);
    const initialDelay = setTimeout(() => {
      fetchInvites();
    }, 1000);
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
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [fontsLoaded] = useFonts({
    LocalFontAwesome: require('../../assets/FontAwesome.ttf'),
  });

  useEffect(() => {
    setIsClient(true);
    const getName = async () => {
      try {
        const savedName = await AsyncStorage.getItem('user_name');
        if (savedName && savedName !== userName) {
          setUserName(savedName);
        }
      } catch (e) {
        console.error(e);
      }
    };
    getName();
    const nameInterval = setInterval(getName, 3000);
    return () => clearInterval(nameInterval);
  }, [userName]);

  const handleSendInvite = async () => {
    if (!msg.trim() || isSending) return;
    setIsSending(true);
    try {
      const { secret } = await getSecurityCredentials();
      const response = await fetch(
        `${API_URL}?action=sendInvite&name=${encodeURIComponent(userName)}&secret=${secret}&msg=${encodeURIComponent(msg)}&t=${Date.now()}`
      );
      if (response.ok) {
        setMsg('');
        setModalVisible(false);
      }
    } catch (e) {
      console.warn('Greška pri slanju');
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenVoiceRoom = async () => {
    const nameParam = encodeURIComponent(userName || 'Gost');
    const url = `https://hairyploper.github.io/linkice/?name=${nameParam}`;
    requestMicPermission();
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.error('Ne mogu da otvorim link:', err);
    }
  };

  if (!isClient || !fontsLoaded) return null;

  const HeaderUserInfo = () => (
    <View style={styles.headerRightContainer}>
      <TouchableOpacity onPress={handleOpenVoiceRoom} style={styles.inviteIconBtn}>
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
        <Tabs.Screen name="titles" options={{ href: null }} />
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

  // Countdown Timer Styles
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
