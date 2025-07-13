import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';

// --- Interfaces ---
interface WeatherData {
  location: { name: string; localtime: string; };
  current: { temp_c: number; condition: { text: string; }; };
}
interface Recipe {
    id: string; name: string; category: string; image?: string;
    ingredients?: string[]; steps?: string;
}
interface Suggestion {
    icon: string; dish: string; reason: string; recipe?: Recipe | null;
}
interface DailySuggestionProps {
  weather: WeatherData | null; suggestion: Suggestion | null;
  loading: boolean; errorMsg: string | null; onPress: (recipe: Recipe) => void;
}
interface HistoryItem {
    date: string;
    suggestion: Suggestion;
}

// --- Lógica de Sugerencias (sin cambios) ---
const getSuggestion = (weather: WeatherData | null, recipes: Recipe[]): Suggestion => {
    if (!weather || recipes.length === 0) return { icon: '🤔', dish: "Buscando ideas...", reason: "Cargando información para ti." };
    const localtime = new Date(weather.location.localtime);
    const hour = localtime.getHours(), minutes = localtime.getMinutes();
    const temp = weather.current.temp_c, condition = weather.current.condition.text.toLowerCase();
    if (hour >= 12) {
        if (condition.includes('tormenta')) { const recipe = recipes.find(r => r.name.includes('Pastel de Papa')); if (recipe) return { icon: '⛈️', dish: recipe.name, reason: "¡Para un día de tormenta, algo contundente!", recipe }; }
        if (temp < 10) { const recipe = recipes.find(r => r.category === 'Almuerzo' && (r.name.includes('Cazuela') || r.name.includes('Pantrucas'))); if (recipe) return { icon: '🥶', dish: recipe.name, reason: "¡Mucho frío! Ideal para una sopa reponedora.", recipe }; }
        if (temp > 28) { const recipe = recipes.find(r => r.name.includes('Pescado Frito')); if (recipe) return { icon: '🥵', dish: recipe.name, reason: "¡Mucho calor! Algo fresco es la mejor opción.", recipe }; }
    }
    let targetCategory = '', defaultMessage: Suggestion | null = null, customReason: string | null = null;
    if (hour < 12 || (hour === 11 && minutes < 30)) { targetCategory = 'Desayuno'; defaultMessage = { icon: '☀️', dish: "Un rico desayuno", reason: "¡Para empezar el día con energía!" }; }
    else if ((hour >= 11 && minutes >= 30) || (hour > 11 && hour < 15)) { targetCategory = 'Almuerzo'; customReason = "¿Qué haremos de rico hoy?"; }
    else if (hour >= 15 && (hour < 16 || (hour === 16 && minutes < 30))) { targetCategory = 'Break'; defaultMessage = { icon: '☕', dish: "Un merecido break", reason: "Una pausa para recargar energías." }; }
    else if ((hour === 16 && minutes >= 30) || (hour > 16 && hour < 20)) { targetCategory = 'Once'; defaultMessage = { icon: '🥐', dish: "Algo rico para la once", reason: "El momento más esperado del día." }; }
    else if (hour >= 20) { targetCategory = 'Noche'; defaultMessage = { icon: '🌙', dish: "Una cena liviana", reason: "Para terminar el día sin pesadez." }; }
    let candidates = recipes.filter(r => r.category === targetCategory);
    if (targetCategory === 'Almuerzo' && candidates.length > 0) {
        let weatherCandidates: Recipe[] = [];
        if (temp < 18 || condition.includes('lluvia')) { weatherCandidates = candidates.filter(r => !r.name.includes('Pescado Frito')); }
        else if (condition.includes('soleado') || condition.includes('despejado')) { weatherCandidates = candidates.filter(r => r.name.includes('Pescado Frito') || r.name.includes('Pastel de Papa')); }
        if (weatherCandidates.length > 0) candidates = weatherCandidates;
    }
    if (targetCategory === 'Once' && condition.includes('lluvia')) { const recipe = recipes.find(r => r.name.includes('Calzones Rotos')); if (recipe) return { icon: '🌧️', dish: recipe.name, reason: "¡Perfecto para una tarde de lluvia!", recipe }; }
    if (candidates.length > 0) { const recipe = candidates[Math.floor(Math.random() * candidates.length)]; return { icon: '😋', dish: recipe.name, reason: customReason || defaultMessage?.reason || "¿Qué te parece esta idea?", recipe }; }
    return defaultMessage || { icon: '🤔', dish: "Buscando ideas...", reason: "Veamos qué se nos ocurre." };
};
const getCurrentCategory = (localtime: Date): string => {
    const hour = localtime.getHours(), minutes = localtime.getMinutes();
    if (hour < 11 || (hour === 11 && minutes < 30)) return 'Desayuno';
    if ((hour >= 11 && minutes >= 30) || (hour > 11 && hour < 15)) return 'Almuerzo';
    if (hour >= 15 && (hour < 16 || (hour === 16 && minutes < 30))) return 'Break';
    if ((hour >= 16 && minutes >= 30) || (hour > 16 && hour < 20)) return 'Once';
    if (hour >= 20) return 'Noche';
    return 'General';
};

// --- Componente Modal (sin cambios) ---
const RecipeModal = ({ visible, onClose, recipe }: { visible: boolean, onClose: () => void, recipe: Recipe | null }) => {
    if (!recipe) return null;
    const imageUrl = (recipe.image && typeof recipe.image === 'string' && recipe.image.startsWith('http')) ? recipe.image : 'https://placehold.co/600x400/FF5C00/FFFFFF?text=Receta';
    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <View style={modalStyles.modalContainer}><View style={modalStyles.modalContent}><Image source={{ uri: imageUrl }} style={modalStyles.modalImage} /><ScrollView style={modalStyles.modalScrollView}><Text style={modalStyles.modalTitle}>{recipe.name}</Text><Text style={modalStyles.modalSubtitle}>Ingredientes</Text>{recipe.ingredients?.map((ingredient, index) => (<Text key={index} style={modalStyles.modalText}>• {ingredient}</Text>))}<Text style={modalStyles.modalSubtitle}>Preparación</Text><Text style={modalStyles.modalText}>{recipe.steps?.replace(/\\n/g, '\n')}</Text></ScrollView><TouchableOpacity style={modalStyles.closeButton} onPress={onClose}><Text style={modalStyles.closeButtonText}>Cerrar</Text></TouchableOpacity></View></View>
        </Modal>
    );
};

// --- Componente de la Tarjeta de Sugerencia (Rediseñado) ---
const DailySuggestion = ({ weather, suggestion, loading, errorMsg, onPress }: DailySuggestionProps) => {
    const handlePress = () => { if (suggestion?.recipe) { onPress(suggestion.recipe); } };
    return (
        <View style={styles.suggestionOuterContainer}>
            <TouchableOpacity onPress={handlePress} disabled={!suggestion?.recipe} style={styles.suggestionCard}>
                <LinearGradient colors={[Colors.theme.secondary, Colors.theme.primary]} style={styles.suggestionGradient}>
                    {loading ? (<ActivityIndicator color={Colors.theme.textLight} size="large" />)
                    : errorMsg ? (<Text style={styles.errorText}>{errorMsg}</Text>)
                    : weather && suggestion ? (
                        <>
                            <View style={styles.weatherContainer}>
                                <FontAwesome name="map-marker" size={16} color={Colors.theme.textLight} />
                                <Text style={styles.locationText}>{weather.location.name}</Text>
                                <Text style={styles.temperatureText}>{Math.round(weather.current.temp_c)}°C</Text>
                            </View>
                            <Text style={styles.suggestionDish}>{suggestion.icon} {suggestion.dish}</Text>
                            <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
                        </>
                    ) : null}
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
};

// --- Componente de la Pantalla Principal ---
export default function HomeScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

    const handleOpenModal = (recipe: Recipe) => { setSelectedRecipe(recipe); setModalVisible(true); };
    const handleCloseModal = () => { setModalVisible(false); setSelectedRecipe(null); };

    const handleProfilePress = () => {
        if (user) {
            router.push('./profile');
        } else {
            router.push('/(auth)/login');
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') throw new Error('Permiso de ubicación denegado.');
                let location = await Location.getCurrentPositionAsync({});
                const { latitude, longitude } = location.coords;
                const weatherUrl = `https://api.weatherapi.com/v1/current.json?key=8c208ed7e4884a6d9be184335250207&q=${latitude},${longitude}&lang=es`;
                const weatherResponse = await fetch(weatherUrl);
                const weatherData = await weatherResponse.json();
                if (!weatherResponse.ok) throw new Error(weatherData.error?.message || 'Error de la API del clima');
                setWeather(weatherData);
                const querySnapshot = await getDocs(collection(db, "recipes"));
                const recipesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Recipe[];
                if (weatherData && recipesData.length > 0) {
                    const localtime = new Date(weatherData.location.localtime);
                    const currentCategory = getCurrentCategory(localtime);
                    const today = new Date().toISOString().split('T')[0];
                    const storageKey = `suggestion-${today}-${currentCategory}`;
                    const storedSuggestionJSON = await AsyncStorage.getItem(storageKey);
                    let todaysSuggestion: Suggestion;
                    if (storedSuggestionJSON) { todaysSuggestion = JSON.parse(storedSuggestionJSON); }
                    else { todaysSuggestion = getSuggestion(weatherData, recipesData); await AsyncStorage.setItem(storageKey, JSON.stringify(todaysSuggestion)); }
                    setSuggestion(todaysSuggestion);
                    const historyJSON = await AsyncStorage.getItem('suggestionHistory');
                    let history: HistoryItem[] = historyJSON ? JSON.parse(historyJSON) : [];
                    const alreadyInHistory = history.some(item => item.date === today && item.suggestion.dish === todaysSuggestion.dish);
                    if (!alreadyInHistory) {
                        history.push({ date: today, suggestion: todaysSuggestion });
                        const sevenDaysAgo = new Date();
                        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                        const filteredHistory = history.filter(item => new Date(item.date) >= sevenDaysAgo);
                        await AsyncStorage.setItem('suggestionHistory', JSON.stringify(filteredHistory));
                    }
                }
            } catch (error: any) { console.error('Error fetching data:', error); setErrorMsg(error.message); }
            finally { setLoading(false); }
        };
        fetchData();
    }, []);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return `Buenos días, ${user?.name || ''}`;
        if (hour < 20) return `Buenas tardes, ${user?.name || ''}`;
        return `Buenas noches, ${user?.name || ''}`;
    };

    return (
        <ScrollView style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>{getGreeting()}</Text>
                    <Text style={styles.title}>Mi Sazón</Text>
                </View>
                <TouchableOpacity onPress={handleProfilePress}>
                    <Image source={ user?.photoURL ? { uri: user.photoURL } : require('../../assets/images/logo.png')} style={styles.profileImage} />
                </TouchableOpacity>
            </View>

            <DailySuggestion weather={weather} suggestion={suggestion} loading={loading} errorMsg={errorMsg} onPress={handleOpenModal} />

            <View style={styles.optionsContainer}>
                <TouchableOpacity style={styles.optionButton} onPress={() => router.push('./discover')}>
                    <FontAwesome name="search" size={24} color={Colors.theme.primary} />
                    <Text style={styles.optionText}>Descubrir</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionButton} onPress={() => router.push('./planner')}>
                    <FontAwesome name="calendar" size={24} color={Colors.theme.primary} />
                    <Text style={styles.optionText}>Planificador</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionButton} onPress={() => router.push('./pantry')}>
                    <FontAwesome name="shopping-basket" size={24} color={Colors.theme.primary} />
                    <Text style={styles.optionText}>Mi Despensa</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionButton} onPress={() => router.push('./map')}>
                    <FontAwesome name="map-marker" size={24} color={Colors.theme.primary} />
                    <Text style={styles.optionText}>Mapa</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionButton} onPress={() => router.push('./historial')}>
                    <FontAwesome name="history" size={24} color={Colors.theme.primary} />
                    <Text style={styles.optionText}>Historial</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionButton} onPress={() => router.push('./favorites')}>
                    <FontAwesome name="star" size={24} color={Colors.theme.primary} />
                    <Text style={styles.optionText}>Favoritos</Text>
                </TouchableOpacity>
            </View>
            
            <RecipeModal visible={modalVisible} onClose={handleCloseModal} recipe={selectedRecipe} />
        </ScrollView>
    );
}

// --- Estilos ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.theme.background,
        paddingTop: 60,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    greeting: {
        fontSize: 16,
        color: Colors.theme.grey,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.theme.text,
    },
    profileImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    suggestionOuterContainer: {
        paddingHorizontal: 20,
        shadowColor: Colors.theme.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 15,
        marginBottom: 30,
    },
    suggestionCard: {
        borderRadius: 24,
        overflow: 'hidden',
    },
    suggestionGradient: {
        padding: 25,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 180,
    },
    weatherContainer: {
        position: 'absolute',
        top: 15,
        left: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 15,
    },
    locationText: {
        color: Colors.theme.textLight,
        fontWeight: '600',
        marginLeft: 5,
    },
    temperatureText: {
        color: Colors.theme.textLight,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    suggestionDish: {
        fontSize: 25,
        color: Colors.theme.textLight,
        fontWeight: 'bold',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.15)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 3,
    },
    suggestionReason: {
        fontSize: 16,
        color: Colors.theme.textLight,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 8,
        opacity: 0.9,
    },
    errorText: {
        fontSize: 16,
        color: Colors.theme.textLight,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    optionButton: {
        alignItems: 'center',
        backgroundColor: Colors.theme.card,
        padding: 20,
        borderRadius: 18,
        width: '48%',
        marginBottom: 15,
        shadowColor: Colors.theme.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    optionText: {
        marginTop: 10,
        fontSize: 14,
        fontWeight: '600',
        color: Colors.theme.text,
    },
});

const modalStyles = StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalContent: { width: '90%', height: '75%', backgroundColor: 'white', borderRadius: 20, overflow: 'hidden' },
    modalImage: { width: '100%', height: '40%' },
    modalScrollView: { padding: 20 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 15 },
    modalSubtitle: { fontSize: 18, fontWeight: 'bold', marginTop: 10, marginBottom: 5 },
    modalText: { fontSize: 16, lineHeight: 24 },
    closeButton: { backgroundColor: Colors.theme.primary, padding: 15, alignItems: 'center' },
    closeButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
