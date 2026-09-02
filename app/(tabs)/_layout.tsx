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
  Pressable,
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

type VacationTimerState = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  phase: 'countdown' | 'celebration' | 'finished';
};

const VACATION_START_AT = new Date('2026-09-12T00:00:00+02:00').getTime();
const VACATION_CELEBRATION_END_AT = new Date('2026-09-13T00:00:00+02:00').getTime();

// Temporary vacation-day feature: flip this to false to remove the celebration in one line.
const SHOW_VACATION_DAY_CELEBRATION = true;
const SHOW_VOICE_ROOM_LINK = false;

function getVacationTimerState(now = Date.now()): VacationTimerState {
  const difference = VACATION_START_AT - now;

  if (difference > 0) {
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      phase: 'countdown',
    };
  }

  return {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    phase: now < VACATION_CELEBRATION_END_AT ? 'celebration' : 'finished',
  };
}

function TabBarIcon({ name, color, size = 28 }: { name: IconName; color: string; size?: number }) {
  return <Text style={[styles.iconText, { color, fontSize: size }]}>{Glyphs[name]}</Text>;
}

function VacationDayCelebration() {
  const celebrationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(celebrationAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(celebrationAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [celebrationAnim]);

  const gyroStyle = {
    transform: [
      {
        rotate: celebrationAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['-10deg', '10deg'],
        }),
      },
      {
        translateY: celebrationAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, -2],
        }),
      },
    ],
  };

  const greekFlagStyle = {
    transform: [
      {
        rotate: celebrationAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['-4deg', '4deg'],
        }),
      },
      {
        translateY: celebrationAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.5, -1],
        }),
      },
    ],
  };

  return (
    <View style={styles.celebrationContent}>
      <Animated.Text style={[styles.gyroEmoji, gyroStyle]}>🥙</Animated.Text>
      <View style={styles.celebrationTextContainer}>
        <View style={styles.celebrationTitleRow}>
          <Text
            style={styles.celebrationTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            OPALA! ODMOR JE TU!
          </Text>
          <Animated.Text style={[styles.greekFlag, greekFlagStyle]}>🇬🇷</Animated.Text>
        </View>
        <Text
          style={styles.celebrationSubtitle}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          Kalimera olimera nema više menadžera!
        </Text>
      </View>
    </View>
  );
}

function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState<VacationTimerState>(() => getVacationTimerState());
  const [isCelebrationPreview, setIsCelebrationPreview] = useState(false);

  const moveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getVacationTimerState()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isActive = true;

    const runConveyorBelt = () => {
      if (!isActive || timeLeft.phase !== 'countdown') return;

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

    if (timeLeft.phase === 'countdown') {
      runConveyorBelt();
    } else {
      moveAnim.setValue(0);
    }

    return () => {
      isActive = false;
      moveAnim.stopAnimation();
    };
  }, [timeLeft.phase, moveAnim]);

  const isCelebrating =
    SHOW_VACATION_DAY_CELEBRATION && (timeLeft.phase === 'celebration' || isCelebrationPreview);

  // Outside the countdown and its one-day celebration, this temporary header item disappears.
  if (timeLeft.phase !== 'countdown' && !isCelebrating) return null;

  return (
    <Pressable
      style={[styles.countdownContainer, isCelebrating && styles.celebrationContainer]}
      onLongPress={
        __DEV__ && SHOW_VACATION_DAY_CELEBRATION
          ? () => setIsCelebrationPreview((current) => !current)
          : undefined
      }
      delayLongPress={550}
      accessibilityRole={__DEV__ ? 'button' : undefined}
      accessibilityLabel={isCelebrating ? 'Proslava početka odmora' : 'Odbrojavanje do odmora'}
      accessibilityHint={__DEV__ ? 'Dugo pritisnite za pregled proslave' : undefined}
    >
      {isCelebrating ? (
        <VacationDayCelebration />
      ) : (
        <>
          <Text style={styles.countdownWorker}>👷‍♂️</Text>
          <View style={styles.conveyorBeltClip}>
            <Animated.View style={[styles.conveyorBelt, { transform: [{ translateX: moveAnim }] }]}>
              <Text style={styles.box}>📦</Text>
              <Text style={styles.box}>📦</Text>
              <Text style={styles.box}>📦</Text>
            </Animated.View>
          </View>
          <Text style={styles.factoryWorker}>🏭</Text>
          <View style={styles.countdownTextContainer}>
            <Text style={styles.countdownLabel}>radi se još...</Text>
            <Text style={styles.countdownTime}>
              {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
            </Text>
          </View>
        </>
      )}
    </Pressable>
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
  countdownWorker: {
    fontSize: 18,
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
  celebrationContainer: {
    width: 240,
    maxWidth: 240,
    minHeight: 42,
    paddingLeft: 7,
    paddingRight: 2,
    paddingVertical: 3,
    backgroundColor: '#F3F9FF',
  },
  celebrationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 5,
  },
  gyroEmoji: {
    fontSize: 22,
  },
  celebrationTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  celebrationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  celebrationTitle: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
    color: '#07549A',
    letterSpacing: 0.25,
  },
  greekFlag: {
    marginLeft: 3,
    fontSize: 11,
    lineHeight: 13,
  },
  celebrationSubtitle: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    color: '#1976D2',
  },
});
