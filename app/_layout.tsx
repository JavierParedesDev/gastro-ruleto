import { FontAwesome } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import React, { useEffect } from 'react';
import 'react-native-reanimated';
import { LoginPromptModal } from '../components/LoginPromptModal';
import { AuthProvider } from '../context/AuthContext';

// Prevenir que la pantalla de splash se oculte automáticamente
SplashScreen.preventAutoHideAsync();


function RootLayoutNav() {
  return (
    <>
      <Stack>
        {/* Define los grupos de pantallas */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        {/* Se registra el grupo 'profile' y se oculta su header */}
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        
        {/* Define las pantallas modales */}
        <Stack.Screen name="cookingMode" options={{ title: 'Modo Cocina', presentation: 'modal' }} />
        <Stack.Screen name="createPost" options={{ title: 'Crear Publicación', presentation: 'modal' }} />
        <Stack.Screen name="profile/[userId]" options={{ title: 'Perfil', presentation: 'modal' }} />

        {/* Pantalla para rutas no encontradas */}
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
    <AuthProvider>
        <RootLayoutNav />
    </AuthProvider>
  );
}
