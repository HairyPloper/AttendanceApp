import React from 'react';
import { StyleSheet, Text } from 'react-native';

interface CustomTabBarIconProps {
  name: 'user' | 'calendar';
  color: string;
  size?: number;
}

export default function CustomTabBarIcon({ name, color, size = 24 }: CustomTabBarIconProps) {
  // Mapping names to FontAwesome Unicode Hex Codes
  // \uf007 = user icon
  // \uf073 = calendar icon
  const iconMap = {
    user: '\uf007',
    calendar: '\uf073',
  };

  return (
    <Text
      style={[
        styles.icon,
        {
          color: color,
          fontSize: size,
        },
      ]}
    >
      {iconMap[name]}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: {
    // This string must be EXACTLY the same as the key in RootLayout's useFonts
    fontFamily: 'MyFontAwesome', 
  },
});