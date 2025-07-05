import { FontAwesome } from '@expo/vector-icons'; // Importar FontAwesome
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
// Tus componentes personalizados
import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';


export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        // Mantén tus props personalizadas si las tienes
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
          // Usamos FontAwesome para el ícono de inicio
          tabBarIcon: ({ color }) => <FontAwesome name="home" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="historial" // El nombre del archivo es history.tsx
        options={{
          title: 'Historial',
          // Usamos FontAwesome para el ícono de historial
          tabBarIcon: ({ color }) => <FontAwesome name="history" size={24} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="map" // El nombre del archivo es history.tsx
        options={{
          title: 'Mapa',
          // Usamos FontAwesome para el ícono de historial
          tabBarIcon: ({ color }) => <FontAwesome name="map-marker" size={24} color={color} />,
        }}
      />

      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorito',
          // Usamos FontAwesome para el ícono de ruleta
          tabBarIcon: ({ color }) => <FontAwesome name="star" size={24} color={color} />,
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notificaciones',
          // Usamos FontAwesome para el ícono de perfil
          tabBarIcon: ({ color }) => <FontAwesome name="bell" size={24} color={color} />,
        }}
      />

     
   
   
    </Tabs>
  );
}
