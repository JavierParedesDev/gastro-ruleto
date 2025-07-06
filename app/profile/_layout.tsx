import { Stack } from 'expo-router';
import React from 'react';

export default function ProfileStackLayout() {
  return (
    <Stack>
      {/* Esta pantalla corresponde al archivo [userId].tsx.
        El header de esta pantalla mostrará dinámicamente el nombre del usuario
        gracias a la configuración que ya hicimos dentro de [userId].tsx.
      */}
      <Stack.Screen 
        name="[userId]" 
        options={{ 
          title: 'Perfil', // Un título genérico mientras carga el nombre del usuario
        }} 
      />
    </Stack>
  );
}
