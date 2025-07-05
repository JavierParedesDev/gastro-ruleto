import { FontAwesome } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import 'react-native-reanimated';
import { LoginPromptModal } from '../components/LoginPromptModal';
import { AuthProvider, useAuth } from '../context/AuthContext';

SplashScreen.preventAutoHideAsync();

const InitialLayout = () => {
    const { user, loading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        // Comprueba si la ruta actual está dentro del grupo (auth)
        const inAuthGroup = segments[0] === '(auth)';

        // **LÓGICA CORREGIDA**
        // Si el usuario está logueado y se encuentra en una pantalla de autenticación,
        // lo redirigimos a la pantalla principal de la app.
        if (user && inAuthGroup) {
            router.replace('/(tabs)');
        } 
        // Si el usuario NO está logueado y está intentando acceder a una pantalla
        // protegida (fuera del grupo de autenticación), lo dejamos donde está,
        // ya que el modal de "promptLogin" se encargará de invitarlo a iniciar sesión.
        // Ya no es necesario forzar una redirección aquí.

    }, [user, loading, segments]);

    return (
        <>
            <Stack>
                {/* Se define el grupo de pestañas principal */}
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                {/* Se define el grupo de autenticación */}
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                {/* Se definen otras pantallas que no están en las pestañas */}
                <Stack.Screen name="profile" options={{ title: 'Mi Perfil' }} />
                <Stack.Screen name="login" options={{ title: 'Iniciar Sesión' }} />
                <Stack.Screen name="register" options={{ title: 'Crear Cuenta' }} />

                <Stack.Screen name="cookingMode" options={{ title: 'Modo Cocina', presentation: 'modal' }} />
                <Stack.Screen name="planner" options={{ title: 'Planificador' }} />
                <Stack.Screen name="+not-found" />
            </Stack>
            {/* El modal de invitación al login está disponible en toda la app */}
            <LoginPromptModal />
        </>
    );
};


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
        <InitialLayout />
    </AuthProvider>
  );
}
