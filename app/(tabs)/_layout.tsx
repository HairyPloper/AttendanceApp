import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * 1. MANUAL GLYPH MAPPING
 * Using Unicode hex codes for FontAwesome icons.
 */
const Glyphs = {
  camera: '\uf030',
  'clock-o': '\uf017',
  trophy: '\uf091',
};

type IconName = keyof typeof Glyphs;

/**
 * 2. CUSTOM TAB BAR ICON COMPONENT
 */
function TabBarIcon({ name, color, size = 28 }: { name: IconName; color: string; size?: number }) {
  return (
    <Text style={[styles.iconText, { color: color, fontSize: size }]}>
      {Glyphs[name]}
    </Text>
  );
}

export default function TabLayout() {
  const [userName, setUserName] = useState<string>('');
  
  const [fontsLoaded] = useFonts({
    'LocalFontAwesome': require('../../assets/FontAwesome.ttf'),
  });

  // Fetch name once when layout mounts to display in the header
  useEffect(() => {
    const getName = async () => {
      try {
        const savedName = await AsyncStorage.getItem('user_name');
        if (savedName) setUserName(savedName);
      } catch (e) {
        console.error("Failed to load user_name", e);
      }
    };
    getName();
  }, []);

  if (!fontsLoaded) return null;

  /**
   * 3. HEADER USER INFO COMPONENT
   * Displays the "ŠMIBER" brand and the current user's name.
   */
  const HeaderUserInfo = () => (
    <View style={styles.headerRightContainer}>
      <Text style={styles.brandText}>ŠMIBER</Text>
      <Text style={styles.userSubText}>{userName || 'Gost'}</Text>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2196F3',
        headerShown: true,
        tabBarShowLabel: true,
        tabBarStyle: { height: 55 },
        // Set the global headerRight to show user info on every tab
        headerRight: () => <HeaderUserInfo />,
      }}>
      
      <Tabs.Screen
        name="index"
        options={{
          title: 'Skeniraj',
          headerTitle: () => <TabBarIcon name="camera" color="#666" />,
          tabBarIcon: ({ color }) => <TabBarIcon name="camera" color={color} />,
        }}
      />

      <Tabs.Screen
        name="UserHistory"
        options={{
          title: 'Pregled',
          headerTitle: () => <TabBarIcon name="clock-o" color="#666" />,
          tabBarIcon: ({ color }) => <TabBarIcon name="clock-o" color={color} />,
        }}
      />

      <Tabs.Screen
        name="Leaderboard"
        options={{
          title: 'Rang lista',
          headerTitle: () => <TabBarIcon name="trophy" color="#666" />,
          tabBarIcon: ({ color }) => <TabBarIcon name="trophy" color={color} />,
        }}
      />

      <Tabs.Screen
        name="titles"
        options={{
          href: null, // Hides this tab from the bottom bar
        }}
      />
    </Tabs>
  );
}

/**
 * 4. STYLES
 */
const styles = StyleSheet.create({
  iconText: {
    fontFamily: 'LocalFontAwesome',
    marginBottom: -3,
    textAlign: 'center',
  },
  headerRightContainer: {
    marginRight: 15,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#2196F3', // Professional Blue
    letterSpacing: 2, // Modern spacing
    marginBottom: -1,
    textTransform: 'uppercase',
  },
  userSubText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
});