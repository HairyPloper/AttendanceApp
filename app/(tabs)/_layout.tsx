import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router'; // <--- Ensure this line exists!
import React from 'react';

// This helper component handles the icons
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2196F3', // Professional Blue
        headerShown: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan',
          headerTitle: ()=><TabBarIcon name="camera" color='#666' />,
          // headerShown:false,/
          tabBarIcon: ({ color }) => <TabBarIcon name="camera" color={color} />,
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'History',
          headerTitle: ()=><TabBarIcon name="clock-o" color='#666' />,
          tabBarIcon: ({ color }) => <TabBarIcon name="clock-o" color={color} />,
        }}
      />
    </Tabs>
  );
}