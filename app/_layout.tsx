import { FontAwesome } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { LoginPromptModal } from '../components/LoginPromptModal';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { registerForPushNotificationsAsync } from '../hooks/usePushNotifications';

// Prevenir que la pantalla de splash se oculte automáticamente
SplashScreen.preventAutoHideAsync();

function RootApp() {
  const { user, updateUserPushToken } = useAuth();

  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          updateUserPushToken(token);
        }
      });
    }
  }, [user]);

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <>
      <Stack>
    
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />

        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="discover" options={{ headerShown: false }} />
        <Stack.Screen name="pantry" options={{ headerShown: false }} />
        <Stack.Screen name="planner" options={{ headerShown: false }} />
        <Stack.Screen name="historial" options={{ headerShown: false }} />
 
        <Stack.Screen name="cookingMode" options={{ title: 'Modo Cocina', presentation: 'modal' }} />
        <Stack.Screen name="createPost" options={{ title: 'Crear Publicación', presentation: 'modal' }} />
        <Stack.Screen name="profile/[userId]" options={{ title: 'Perfil', presentation: 'modal' }} />
        <Stack.Screen name='favorites' options={{ headerShown: false }} />

        <Stack.Screen name="+not-found" />
      </Stack>
      
      <LoginPromptModal />
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <NotificationProvider> 
          <RootApp />
        </NotificationProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
