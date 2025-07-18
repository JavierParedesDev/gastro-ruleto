// constants/Colors.ts

const tintColorLight = '#FF5C00';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
  // Tu paleta de colores personalizada - Propuesta 1
  theme: {
    primary: '#FF5C00',     // Naranja principal
    secondary: '#0033beff',   // Azul vibrante para acentos y botones
    accent: '#FF8C42',      // Naranja más claro para toques sutiles
    background: '#F8F9FA',  // Un fondo muy claro, casi blanco
    text: '#343A40',        // Texto oscuro principal
    textLight: '#FFFFFF',   // Texto claro para fondos oscuros
    card: '#FFFFFF',        // Color de las tarjetas
    shadow: '#000000',      // Color para las sombras
    grey: '#888888',        // Un gris para textos secundarios
  }
};
