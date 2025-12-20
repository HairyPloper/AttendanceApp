import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

/**
 * 1. MANUAL GLYPH MAPPING
 * Since we aren't using the expo library, we map names to Unicode hex codes.
 * \uf030 is the code for 'camera'
 * \uf017 is the code for 'clock-o'
 */
const Glyphs = {
  camera: '\uf030',
  'clock-o': '\uf017',
};

// Define the type for our icon names based on the object above
type IconName = keyof typeof Glyphs;

/**
 * 2. CUSTOM TAB BAR ICON COMPONENT
 * This uses a standard React Native Text component styled with your local font.
 */
function TabBarIcon({ name, color, size = 28 }: { name: IconName; color: string; size?: number }) {
  return (
    <Text 
      style={[
        styles.iconText, 
        { color: color, fontSize: size }
      ]}
    >
      {Glyphs[name]}
    </Text>
  );
}

export default function TabLayout() {
  /**
   * 3. LOAD LOCAL FONT
   * Ensure the path '../../assets/FontAwesome.ttf' matches exactly 
   * where you pasted the file.
   */
  const [fontsLoaded] = useFonts({
    'LocalFontAwesome': require('../../assets/FontAwesome.ttf'),
  });

  // 4. Wait for font to load to avoid seeing "X" or "boxes" instead of icons
  if (!fontsLoaded) return null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2196F3', // Professional Blue
        headerShown: true,
        tabBarShowLabel: true,
        tabBarStyle:{
          height:55
        }
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
        name="two"
        options={{
          title: 'Pregled',
          headerTitle: () => <TabBarIcon name="clock-o" color="#666" />,
          tabBarIcon: ({ color }) => <TabBarIcon name="clock-o" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconText: {
    fontFamily: 'LocalFontAwesome', // Must match the key used in useFonts
    marginBottom: -3,
    textAlign: 'center',
  },
});