import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout() {
  return (
    // Este Stack se aplica solo a las pantallas dentro de la carpeta (auth).
    // Al configurar screenOptions aquí, nos aseguramos de que ninguna de
    // las pantallas de este grupo (login, register) muestre el header.
    <Stack screenOptions={{ headerShown: false }} />
  );
}
