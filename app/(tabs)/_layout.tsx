import { FontAwesome } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useColorScheme } from '@/hooks/useColorScheme';

// --- Componente para el Ícono con Indicador ---
const TabBarIconWithBadge = ({ name, color, hasBadge }: { name: React.ComponentProps<typeof FontAwesome>['name'], color: string, hasBadge: boolean }) => (
    <View>
        <FontAwesome name={name} size={24} color={color} />
        {hasBadge && <View style={styles.badgeStyle} />}
    </View>
);

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { unreadCount } = useNotifications();
  const { user } = useAuth(); // Obtenemos el estado del usuario

  // Calcular si hay nuevos premios (insignias o marcos)
  const hasNewRewards = user ? 
      ((user.badges?.length || 0) > (user.viewedBadgesCount || 0)) ||
      ((user.frames?.length || 0) > (user.viewedFramesCount || 0))
      : false;

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: Colors[colorScheme ?? 'light'].background,
          borderTopColor: colorScheme === 'dark' ? '#222' : '#eee',
        }
      }}>
      
      {/* Pestañas visibles para todos */}
      <Tabs.Screen
        name='community'
        options={{
          title: 'Comunidad',
          tabBarIcon: ({ color }) => <FontAwesome name="users" size={24} color={color} />,
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
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <FontAwesome name="home" size={28} color={color} />,
        }}
      />

      {/* Pestañas condicionales */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notificaciones',
          tabBarIcon: ({ color }) => <FontAwesome name="bell" size={24} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined, 
          tabBarBadgeStyle: { backgroundColor: Colors.theme.primary, color: Colors.theme.textLight },
          // **Ocultar si no está logueado**
          href: user ? '/(tabs)/notifications' : null,
        }}
      />
      <Tabs.Screen
        name='profile'
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => (
            <TabBarIconWithBadge
              name="user"
              color={color}
              hasBadge={hasNewRewards}
            />
          ),
          // **Ocultar si no está logueado**
          href: user ? '/(tabs)/profile' : null,
        }}
      />

      {/* Pestañas que siempre estarán ocultas */}
      <Tabs.Screen name="favorites" options={{ href: null }} />
      <Tabs.Screen name="createPost" options={{ href: null }} />
      
    </Tabs>
  );
}

const styles = StyleSheet.create({
    badgeStyle: {
        position: 'absolute',
        top: -1,
        right: -6,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.theme.primary,
        borderWidth: 1.5,
        borderColor: '#fff', 
    }
});