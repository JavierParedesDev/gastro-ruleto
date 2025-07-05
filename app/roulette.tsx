import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// --- Icono de la Ruleta ---
// No es necesario cambiar esto. Es un componente simple.
const RouletteIcon = () => (
    <View style={styles.rouletteIconContainer}>
        <Text style={styles.rouletteIconText}>🍽️</Text>
    </View>
);

// --- Componente de la Pantalla Principal ---
// Ahora todo está dentro de un componente que exportamos por defecto.
export default function  RouletteScreen() {
    // --- Estado y Animación ---
    const spinValue = useRef(new Animated.Value(0)).current;
    const [currentRecipe, setCurrentRecipe] = useState('Presiona para descubrir');
    const [isSpinning, setIsSpinning] = useState(false);

    // --- Recetas de Ejemplo ---
    const recipes = [
        "Pastel de Choclo",
        "Empanadas de Pino",
        "Cazuela de Vacuno",
        "Porotos Granados",
        "Charquicán",
        "Humitas",
        "Lomo a lo Pobre"
    ];

    // --- Función para la Animación ---
    const spinRoulette = () => {
        if (isSpinning) return; // Evita giros múltiples
        setIsSpinning(true);

        spinValue.setValue(0);
        
        const randomIndex = Math.floor(Math.random() * recipes.length);
        const selectedRecipe = recipes[randomIndex];

        Animated.timing(spinValue, {
            toValue: 1,
            duration: 2500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }).start(() => {
            setCurrentRecipe(selectedRecipe);
            setIsSpinning(false); // Permite girar de nuevo
        });
    };

    // --- Interpolación para el Giro ---
    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '1800deg'],
    });

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#FF8C42', '#FF5C00']}
                style={styles.background}
            />
            {/* Asegúrate que el StatusBar se vea bien en tu layout */}
            <StatusBar style="light" />

            <View style={styles.header}>
                <Text style={styles.title}>Gastro-Ruleto</Text>
                <Text style={styles.subtitle}>¿Qué comemos hoy?</Text>
            </View>

            <View style={styles.rouletteContainer}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <RouletteIcon />
                </Animated.View>
            </View>
            
            <View style={styles.resultContainer}>
                <Text style={styles.resultText}>{currentRecipe}</Text>
            </View>

            <TouchableOpacity style={styles.button} onPress={spinRoulette} disabled={isSpinning}>
                <Text style={styles.buttonText}>¡GIRAR!</Text>
            </TouchableOpacity>
        </View>
    );
}

// --- Estilos de la Aplicación (sin cambios) ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: '100%',
    },
    header: {
        alignItems: 'center',
        marginTop: 60, // Ajustado para no chocar con la barra de estado
    },
    title: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#fff',
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: -1, height: 2 },
        textShadowRadius: 5,
    },
    subtitle: {
        fontSize: 20,
        color: '#FFDDC9',
    },
    rouletteContainer: {
        width: 250,
        height: 250,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rouletteIconContainer: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
    },
    rouletteIconText: {
        fontSize: 100,
    },
    resultContainer: {
        padding: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: 15,
        minWidth: '80%',
        alignItems: 'center',
    },
    resultText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#fff',
        paddingVertical: 20,
        paddingHorizontal: 60,
        borderRadius: 30,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 6,
        },
        shadowOpacity: 0.37,
        shadowRadius: 7.49,
        elevation: 12,
        marginBottom: 40,
    },
    buttonText: {
        color: '#FF5C00',
        fontSize: 22,
        fontWeight: 'bold',
    },
});