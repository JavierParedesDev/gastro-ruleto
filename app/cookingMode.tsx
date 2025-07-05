import { FontAwesome } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon'; // **1. Importar la librería de confeti**
import { db } from '../firebaseConfig';

// --- Interfaces ---
interface Recipe {
    id: string;
    name: string;
    category: string;
    image?: string;
    ingredients?: string[];
    steps?: string;
}

// --- Helper para formatear el tiempo ---
const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function CookingModeScreen() {
    useKeepAwake();
    const { recipeId } = useLocalSearchParams();
    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [steps, setSteps] = useState<string[]>([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(true);

    // --- Estados del Temporizador, Sonido y Confeti ---
    const [timerDuration, setTimerDuration] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isTimerActive, setIsTimerActive] = useState(false);
    const intervalRef = useRef<any>(null);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isAlarmRinging, setIsAlarmRinging] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false); // **2. Estado para el confeti**

    // --- Cargar el sonido ---
    useEffect(() => {
        async function loadSound() {
            try {
                const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/alarm.mp3'));
                setSound(sound);
            } catch (error) {
                console.log("No se pudo cargar el archivo de sonido.");
            }
        }
        loadSound();
        return () => { if (sound) { sound.unloadAsync(); } };
    }, []);

    // --- Lógica del Temporizador ---
    useEffect(() => {
        if (isTimerActive && timeLeft > 0) {
            intervalRef.current = setInterval(() => { setTimeLeft(prev => prev - 1); }, 1000);
        } else if (timeLeft === 0 && isTimerActive) {
            setIsTimerActive(false);
            handleTimerEnd();
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isTimerActive, timeLeft]);

    const handleTimerEnd = async () => {
        Vibration.vibrate([500, 500, 500]);
        setIsAlarmRinging(true);
        if (sound) { await sound.replayAsync(); }
    };

    const stopAlarm = async () => {
        if (sound) { await sound.stopAsync(); }
        Vibration.cancel();
        setIsAlarmRinging(false);
    };
    
    const startTimer = () => { if (timerDuration) { setTimeLeft(timerDuration); setIsTimerActive(true); } };
    const pauseTimer = () => setIsTimerActive(false);
    const resetTimer = () => { setIsTimerActive(false); if (timerDuration) setTimeLeft(timerDuration); };

    // --- Lógica de la Receta y Pasos ---
    useEffect(() => {
        const fetchRecipe = async () => {
            if (!recipeId) return;
            setLoading(true);
            try {
                const docRef = doc(db, "recipes", recipeId as string);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const recipeData = { id: docSnap.id, ...docSnap.data() } as Recipe;
                    setRecipe(recipeData);
                    const recipeSteps = recipeData.steps?.split('\n').filter(step => step.trim() !== '') || [];
                    setSteps(recipeSteps);
                }
            } catch (error) { console.error("Error fetching recipe details:", error); }
            finally { setLoading(false); }
        };
        fetchRecipe();
        return () => { Speech.stop(); };
    }, [recipeId]);

    const resetearTiempo =()=>{
        setTimerDuration(null);
        setTimeLeft(0);
        setIsTimerActive(false);
        resetTimer();
    }

    useEffect(() => {
        if (steps[currentStep]) {
            const match = steps[currentStep].match(/(\d+)\s*minutos/);
            if (match && match[1]) {
                const minutes = parseInt(match[1], 10);
                setTimerDuration(minutes * 60);
                setTimeLeft(minutes * 60);
            } else {
                setTimerDuration(null);
            }
            resetTimer();

            // **3. Lógica para activar el confeti**
            if (currentStep === steps.length - 1 && steps.length > 1) {
                setShowConfetti(true);
            } else {
                setShowConfetti(false);
            }
        }
    }, [currentStep, steps]);

    const speakStep = (stepIndex: number) => { if (steps[stepIndex]) { Speech.stop(); Speech.speak(steps[stepIndex], { language: 'es-ES' }); } };
    const speakStop = () => { Speech.stop(); };
    const proceedToStep = (newStep: number) => { if (newStep >= 0 && newStep < steps.length) { setCurrentStep(newStep); speakStep(newStep); } };


    const handleNextStep = () => {
        
        if (isTimerActive) {
            Alert.alert("Temporizador Activo", "¿Seguro que quieres pasar al siguiente paso? El temporizador se reiniciará.", [{ text: "Cancelar", style: "cancel" }, { text: "Sí, continuar", onPress: () => { proceedToStep(currentStep + 1); resetearTiempo(); } }]);
            
        } else {
            proceedToStep(currentStep + 1);
            resetearTiempo();
        }
        
    };

    const handlePrevStep = () => {

        if (isTimerActive) {
            Alert.alert("Temporizador Activo", "¿Seguro que quieres volver al paso anterior? El temporizador se reiniciará.", [{ text: "Cancelar", style: "cancel" }, { text: "Sí, continuar", onPress: () => { proceedToStep(currentStep - 1); resetearTiempo(); } }]);
        } else {
            proceedToStep(currentStep - 1);
            resetearTiempo();
        }
    };

    if (loading) { return <View style={styles.container}><ActivityIndicator size="large" color="#FF5C00" /></View>; }
    if (!recipe) { return <View style={styles.container}><Text>No se encontró la receta.</Text></View>; }

    return (
        <View style={styles.container}>

            <TouchableOpacity onPress={() => speakStep(currentStep)} style={styles.speakButton}>
                <FontAwesome name="volume-up" size={40} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => speakStop()} style={styles.speakMuteButton}>
                <Text style={{ color: 'white', fontSize: 20 }}>🔇</Text>
            </TouchableOpacity>
            
          
            <Stack.Screen options={{ title: recipe.name }} />
            <ScrollView contentContainerStyle={styles.stepContainer}>
                <Text style={styles.stepCounter}>Paso {currentStep + 1} de {steps.length}</Text>
                <Text style={styles.stepText}>{steps[currentStep]}</Text>
              
            </ScrollView>

            {timerDuration && (
                <View style={styles.timerContainer}>
                    <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                    <View style={styles.timerControls}>
                        {!isTimerActive ? (
                            <TouchableOpacity onPress={startTimer} style={styles.timerButton}><FontAwesome name="play" size={20} color="white" /></TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={pauseTimer} style={styles.timerButton}><FontAwesome name="pause" size={20} color="white" /></TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={resetTimer} style={[styles.timerButton, {backgroundColor: '#777'}]}><FontAwesome name="refresh" size={20} color="white" /></TouchableOpacity>
                    </View>
                </View>
            )}

            <View style={styles.controlsContainer}>
                <TouchableOpacity onPress={handlePrevStep} disabled={currentStep === 0} style={styles.navButton}>
                    <FontAwesome name="arrow-left" size={24} color={currentStep === 0 ? '#ccc' : '#333'} />
                    <Text style={[styles.navButtonText, { color: currentStep === 0 ? '#ccc' : '#333' }]}>Anterior</Text>
                </TouchableOpacity>
               
                <TouchableOpacity onPress={handleNextStep} disabled={currentStep === steps.length - 1} style={styles.navButton}>
                    <Text style={[styles.navButtonText, { color: currentStep === steps.length - 1 ? '#ccc' : '#333' }]}>Siguiente</Text>
                    <FontAwesome name="arrow-right" size={24} color={currentStep === steps.length - 1 ? '#ccc' : '#333'} />
                </TouchableOpacity>
            </View>

            {isAlarmRinging && (
                <View style={styles.alarmOverlay}>
                    <TouchableOpacity onPress={stopAlarm} style={styles.stopAlarmButton}>
                        <FontAwesome name="bell-slash" size={50} color="white" />
                        <Text style={styles.stopAlarmText}>Detener Alarma</Text>
                    </TouchableOpacity>
                </View>
            )}
            
            {/* **4. Componente de Confeti** */}
            {showConfetti && 
                <ConfettiCannon 
                    count={200} 
                    origin={{ x: -10, y: 0 }} 
                    autoStart={true}
                    fadeOut={true}
                    onAnimationEnd={() => setShowConfetti(false)} // Opcional: ocultar después de la animación
                />
            }
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9f9f9',
        justifyContent: 'center',
        padding: 20,
        shadowColor: '#000',
        borderRadius: 15,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        zIndex: 1, // Asegura que esté por encima de todo
        overflow: 'hidden',
        position: 'relative',
        marginTop: 20,
        marginHorizontal: 10,
        marginBottom: 20,
        marginVertical: 10,
        
    },
    stepContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepCounter: {
        fontSize: 18,
        color: '#888',
        marginBottom: 20,
    },
    stepText: {
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
        lineHeight: 45,
        color: '#333',
    },
    timerContainer: {
        alignItems: 'center',
        paddingVertical: 20,
        backgroundColor: '#fff',
        borderRadius: 15,
        marginVertical: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    timerText: {
        fontSize: 56,
        fontWeight: '200',
        color: '#333',
    },
    timerControls: {
        flexDirection: 'row',
        marginTop: 15,
    },
    timerButton: {
        backgroundColor: '#34A853',
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 10,
    },
    controlsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        marginBottom: 20,
    },
    navButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
    },
    navButtonText: {
        fontSize: 18,
        marginHorizontal: 10,
    },
    speakButton: {
        backgroundColor: '#FF5C00',
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,

    },

    
    speakMuteButton:{
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: '#c0c0c0',
        width: 50,
        height: 50,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,

    },
    alarmOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10, // Asegura que esté por encima de todo
    },
    stopAlarmButton: {
        alignItems: 'center',
    },
    stopAlarmText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 20,
    },
});
