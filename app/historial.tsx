import { Colors } from '@/constants/Colors';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { RecipeDetailModal } from '../components/RecipeDetailModal';

// --- Interfaces ---
interface Recipe {
    id: string;
    name: string;
    category: string;
    image?: string;
    ingredients?: string[];
    steps?: string;
}

interface Suggestion {
    icon: string;
    dish: string;
    reason: string;
    recipe?: Recipe | null;
}

interface HistoryItem {
    date: string;
    suggestion: Suggestion;
}

// --- Función para formatear la fecha ---
const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
    return new Intl.DateTimeFormat('es-CL', options).format(date);
};

// --- Componente de la Tarjeta de Historial (Rediseñado) ---
const HistoryCard = ({ item, onPress, onToggleFavorite, isFavorite }: { item: HistoryItem, onPress: () => void, onToggleFavorite: () => void, isFavorite: boolean }) => {
    if (!item.suggestion.recipe) {
        // Renderiza una tarjeta simple si no hay receta (poco probable en el historial)
        return (
            <View style={[styles.cardContainer, styles.cardContainerDisabled]}>
                 <View style={styles.cardTextContainer}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.suggestion.dish}</Text>
                    <Text style={styles.cardCategory}>{item.suggestion.reason}</Text>
                </View>
            </View>
        );
    }

    const imageUrl = (item.suggestion.recipe.image && typeof item.suggestion.recipe.image === 'string' && item.suggestion.recipe.image.startsWith('http'))
        ? item.suggestion.recipe.image
        : 'https://placehold.co/600x400/FFDDC9/FF5C00?text=🍲';

    return (
        <Animated.View entering={FadeInUp}>
            <TouchableOpacity style={styles.cardContainer} onPress={onPress}>
                <Image source={{ uri: imageUrl }} style={styles.cardImage} />
                <View style={styles.cardOverlay} />
                <View style={styles.cardTextContainer}>
                    <Text style={styles.cardTitle}>{item.suggestion.dish}</Text>
                    <Text style={styles.cardCategory}>{formatDate(item.date)}</Text>
                </View>
                <TouchableOpacity onPress={onToggleFavorite} style={styles.favoriteButton}>
                    <FontAwesome name={isFavorite ? 'star' : 'star-o'} size={22} color={isFavorite ? Colors.theme.primary : 'white'} />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
};


// --- Pantalla de Historial ---
export default function HistoryScreen() {
    const router = useRouter();
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

    useFocusEffect(
        useCallback(() => {
            const loadData = async () => {
                setLoading(true);
                try {
                    const historyJSON = await AsyncStorage.getItem('suggestionHistory');
                    const savedHistory = historyJSON ? JSON.parse(historyJSON) : [];
                    savedHistory.sort((a: HistoryItem, b: HistoryItem) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    setHistory(savedHistory);

                    const favsJSON = await AsyncStorage.getItem('favorites');
                    setFavorites(favsJSON ? JSON.parse(favsJSON) : []);
                } catch (e) {
                    console.error("Failed to load history.", e);
                } finally {
                    setLoading(false);
                }
            };
            loadData();
        }, [])
    );

    const toggleFavorite = async (recipeId: string) => {
        const updatedFavorites = favorites.includes(recipeId)
            ? favorites.filter(id => id !== recipeId)
            : [...favorites, recipeId];
        setFavorites(updatedFavorites);
        await AsyncStorage.setItem('favorites', JSON.stringify(updatedFavorites));
    };

    const handleStartCooking = (recipeId: string) => {
        handleCloseModal();
        router.push({ pathname: "/cookingMode", params: { recipeId } });
    };

    const handleOpenModal = (recipe: Recipe) => { setSelectedRecipe(recipe); setModalVisible(true); };
    const handleCloseModal = () => { setModalVisible(false); setSelectedRecipe(null); };

    const handleClearHistory = () => {
        Alert.alert(
            "Borrar Historial",
            "¿Estás seguro de que quieres eliminar todo tu historial de sugerencias? Esta acción no se puede deshacer.",
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Borrar", style: "destructive", onPress: async () => {
                    try {
                        await AsyncStorage.removeItem('suggestionHistory');
                        setHistory([]);
                    } catch (e) {
                        console.error("Failed to clear history.", e);
                        Alert.alert("Error", "No se pudo borrar el historial.");
                    }
                }}
            ]
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            {loading ? (
                <View style={styles.loaderContainer}><ActivityIndicator size="large" color={Colors.theme.primary} /></View>
            ) : (
                <FlatList
                    key="history-list" // Clave estática para evitar errores de recarga en caliente
                    data={history}
                    renderItem={({ item }) => (
                        <HistoryCard 
                            item={item} 
                            onPress={() => item.suggestion.recipe && handleOpenModal(item.suggestion.recipe)}
                            onToggleFavorite={() => item.suggestion.recipe && toggleFavorite(item.suggestion.recipe.id)}
                            isFavorite={item.suggestion.recipe ? favorites.includes(item.suggestion.recipe.id) : false}
                        />
                    )}
                    keyExtractor={(item, index) => `${item.date}-${item.suggestion.dish}-${index}`}
                    numColumns={1}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        <View style={styles.headerContainer}>
                            <Text style={styles.headerTitle}>Historial</Text>
                            {history.length > 0 && (
                                <TouchableOpacity onPress={handleClearHistory}>
                                    <Text style={styles.clearButton}>Borrar todo</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <FontAwesome name="history" size={40} color={Colors.theme.grey} />
                            <Text style={styles.emptyText}>Tu historial de sugerencias está vacío.</Text>
                            <Text style={styles.emptySubText}>Las sugerencias del día aparecerán aquí.</Text>
                        </View>
                    }
                />
            )}
            <RecipeDetailModal 
                visible={modalVisible} 
                onClose={handleCloseModal} 
                recipe={selectedRecipe}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: Colors.theme.background 
    },
    loaderContainer: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    listContent: { 
        paddingHorizontal: 15,
        paddingBottom: 40,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 60,
        marginBottom: 15,
        paddingHorizontal: 5,
    },
    headerTitle: { 
        fontSize: 34, 
        fontWeight: 'bold', 
        color: Colors.theme.text, 
    },
    clearButton: {
        fontSize: 14,
        color: Colors.theme.primary,
        fontWeight: '600',
    },
    cardContainer: { 
        width: '100%', 
        height: 200, 
        marginBottom: 20,
        borderRadius: 15, 
        backgroundColor: Colors.theme.card, 
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        justifyContent: 'flex-end',
    },
    cardContainerDisabled: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        height: 150,
    },
    cardImage: { 
        ...StyleSheet.absoluteFillObject, 
        width: '100%', 
        height: '100%', 
        borderRadius: 15 
    },
    cardOverlay: { 
        ...StyleSheet.absoluteFillObject, 
        backgroundColor: 'rgba(0,0,0,0.4)', 
        borderRadius: 15 
    },
    cardTextContainer: { 
        padding: 15 
    },
    cardTitle: { 
        fontSize: 22, 
        fontWeight: 'bold', 
        color: 'white' 
    },
    cardCategory: { 
        fontSize: 14, 
        color: 'rgba(255,255,255,0.8)', 
        marginTop: 4 
    },
    favoriteButton: { 
        position: 'absolute', 
        top: 15, 
        right: 15, 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        padding: 8, 
        borderRadius: 20 
    },
    emptyContainer: { 
        flex: 1,
        marginTop: '40%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: { 
        fontSize: 18, 
        color: Colors.theme.grey,
        fontWeight: '600',
        marginTop: 15,
    },
    emptySubText: {
        fontSize: 14,
        color: Colors.theme.grey,
        marginTop: 5,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
});
