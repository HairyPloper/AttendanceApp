import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_URL = "https://script.google.com/macros/s/AKfycbxe1_meZCJi0kRuL83D_kXxvCBoE1B8VauluPlJQL0fAtoBBo0q5AIFNssSDr5tsOcR/exec";

const Glyphs = {
  camera: '\uf030',
  'clock-o': '\uf017',
  trophy: '\uf091',
  send: '\uf1d8',
};

type IconName = keyof typeof Glyphs;

function TabBarIcon({ name, color, size = 28 }: { name: IconName; color: string; size?: number }) {
  return (
    <Text style={[styles.iconText, { color: color, fontSize: size }]}>
      {Glyphs[name]}
    </Text>
  );
}

/**
 * BANNER COMPONENT
 */
function BroadcastBanner() {
  const [latestInvite, setLatestInvite] = useState<any>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [isClient, setIsClient] = useState(false);

  const fetchInvites = async () => {
    try {
      // Added mode and redirect for better GitHub Pages compatibility
      const res = await fetch(`${API_URL}?action=getInvites&t=${Date.now()}`, {
        method: 'GET',
        mode: 'cors',
        redirect: 'follow'
      });
      
      if (!res.ok) throw new Error("Network response not ok");
      
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
            useNativeDriver: Platform.OS !== 'web' 
          }).start();
        } else {
          setLatestInvite(null);
        }
      }
    } catch (e) { 
      // Changed to silent log to avoid "Red Error" spam on refresh
      console.warn("Banner fetch suppressed: Network warming up..."); 
    }
  };

  useEffect(() => {
    setIsClient(true);
    
    // 1. Initial delay of 2.5 seconds to prevent NetworkError on hard refresh
    const initialDelay = setTimeout(() => {
      fetchInvites();
    }, 1000);

    // 2. Regular polling every 30 seconds
    const interval = setInterval(fetchInvites, 30000);
    
    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  // Hydration guard
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

/**
 * MAIN LAYOUT
 */
export default function TabLayout() {
  const [userName, setUserName] = useState<string>('');
  const [isClient, setIsClient] = useState(false); // Added missing state here
  const [modalVisible, setModalVisible] = useState(false);
  const [msg, setMsg] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [fontsLoaded] = useFonts({
    'LocalFontAwesome': require('../../assets/FontAwesome.ttf'),
  });

  useEffect(() => {
    setIsClient(true);
    
    const getName = async () => {
      try {
        const savedName = await AsyncStorage.getItem('user_name');
        if (savedName && savedName !== userName) {
          setUserName(savedName);
        }
      } catch (e) { console.error(e); }
    };

    getName();
    // Poll for name changes (catches registration from index.tsx)
    const nameInterval = setInterval(getName, 3000);
    return () => clearInterval(nameInterval);
  }, [userName]);

  const handleSendInvite = async () => {
    if (!msg.trim() || isSending) return;
    setIsSending(true);
    try {
      const response = await fetch(`${API_URL}?action=sendInvite&from=${encodeURIComponent(userName)}&msg=${encodeURIComponent(msg)}`);
      if (response.ok) {
        setMsg('');
        setModalVisible(false);
      }
    } catch (e) { alert("Greška pri slanju"); } finally { setIsSending(false); }
  };

  // Prevent hydration error and ensure fonts are ready
  if (!isClient || !fontsLoaded) return null;

  const HeaderUserInfo = () => (
    <View style={styles.headerRightContainer}>
      <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.inviteIconBtn}>
        <Text style={[styles.iconText, { color: '#2196F3', fontSize: 20 }]}>{Glyphs.send}</Text>
      </TouchableOpacity>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.brandText}>ŠMIBER</Text>
        <Text style={styles.userSubText}>{userName || 'Gost'}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <BroadcastBanner />
      <Tabs screenOptions={{ 
        tabBarActiveTintColor: '#2196F3',
        headerShown: true,
        headerRight: () => <HeaderUserInfo />, 
        tabBarStyle: { height: 55 } 
      }}>
        <Tabs.Screen name="index" options={{ title: 'Skeniraj', headerTitle: () => <TabBarIcon name="camera" color="#666" />, tabBarIcon: ({ color }) => <TabBarIcon name="camera" color={color} /> }} />
        <Tabs.Screen name="UserHistory" options={{ title: 'Pregled', headerTitle: () => <TabBarIcon name="clock-o" color="#666" />, tabBarIcon: ({ color }) => <TabBarIcon name="clock-o" color={color} /> }} />
        <Tabs.Screen name="Leaderboard" options={{ title: 'Rang lista', headerTitle: () => <TabBarIcon name="trophy" color="#666" />, tabBarIcon: ({ color }) => <TabBarIcon name="trophy" color={color} /> }} />
        <Tabs.Screen name="titles" options={{ href: null }} />
      </Tabs>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pozovi ostale</Text>
            <TextInput style={styles.input} placeholder="Napiši poruku..." value={msg} onChangeText={setMsg} editable={!isSending} autoFocus />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} disabled={isSending}>
                <Text style={{ color: isSending ? '#ccc' : 'red' }}>Otkaži</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendInvite} disabled={isSending}>
                <Text style={{ color: isSending ? '#aaa' : '#2196F3', fontWeight: 'bold' }}>
                  {isSending ? "Slanje..." : "Pošalji"}
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
  inviteIconBtn: { marginRight: 12, padding: 5 },
  brandText: { fontSize: 10, fontWeight: '900', color: '#2196F3', letterSpacing: 2, textTransform: 'uppercase' },
  userSubText: { fontSize: 14, fontWeight: '700', color: '#333' },
  banner: { backgroundColor: '#E3F2FD', borderBottomWidth: 1, borderBottomColor: '#BBDEFB', paddingVertical: 10, paddingHorizontal: 15 },
  bannerText: { textAlign: 'center', color: '#0D47A1', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
  modalContent: { backgroundColor: 'white', borderRadius: 15, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 }
});