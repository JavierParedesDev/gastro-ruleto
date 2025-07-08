import { FontAwesome } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useNotifications } from '@/context/NotificationContext'; // 1. Importar el hook de notificaciones
import { useColorScheme } from '@/hooks/useColorScheme';


export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { unreadCount } = useNotifications(); // 2. Obtener el contador de notificaciones

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
            ios: {
              position: 'absolute',
            },
            default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <FontAwesome name="home" size={28} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorito',
          tabBarIcon: ({ color }) => <FontAwesome name="star" size={24} color={color} />,
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notificaciones',
          tabBarIcon: ({ color }) => <FontAwesome name="bell" size={24} color={color} />,
          // 3. Mostrar la insignia si hay notificaciones no leídas
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined, 
          tabBarBadgeStyle: { backgroundColor: Colors.theme.primary, color: Colors.theme.textLight }
        }}
      />

      <Tabs.Screen
        name = "duels"
        options={{
          title: 'Duelos',
          tabBarIcon: ({ color }) => <FontAwesome name="trophy" size={24} color={color} />,
        }}
      />

      <Tabs.Screen
        name='createPost'
        options={{
          title: 'Crear Publicación',
          tabBarIcon: ({ color }) => <FontAwesome name="pencil" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name='profile'
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <FontAwesome name="user" size={24} color={color} />,
        }}
      />

      <Tabs.Screen
        name='community'
        options={{
          title: 'Comunidad',
          tabBarIcon: ({ color }) => <FontAwesome name="users" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
