import { Colors } from '@/constants/Colors';
import { db } from '@/firebaseConfig';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, getDocs } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

// --- Componente de la Tarjeta de Receta (Rediseñado) ---
const RecipeCard = ({ item, onPress, onToggleFavorite, isFavorite }: { item: Recipe, onPress: () => void, onToggleFavorite: () => void, isFavorite: boolean }) => {
    const imageUrl = (item.image && typeof item.image === 'string' && item.image.startsWith('http'))
        ? item.image
        : 'https://placehold.co/300x200/FFDDC9/FF5C00?text=🍲';
    return (
        <Animated.View entering={FadeInUp} style={styles.cardWrapper}>
            <TouchableOpacity style={styles.cardContainer} onPress={onPress}>
                <Image source={{ uri: imageUrl }} style={styles.cardImage} />
                <View style={styles.cardOverlay} />
                <View style={styles.cardTextContainer}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardCategory}>{item.category}</Text>
                </View>
                <TouchableOpacity onPress={onToggleFavorite} style={styles.favoriteButton}>
                    <FontAwesome name={isFavorite ? 'star' : 'star-o'} size={22} color={isFavorite ? Colors.theme.primary : 'white'} />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
};

// --- Pantalla de Favoritos ---
export default function FavoritesScreen() {
    const router = useRouter();
    const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
    const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

    // Carga los favoritos cada vez que la pantalla se enfoca
    useFocusEffect(
        useCallback(() => {
            const loadData = async () => {
                setLoading(true);
                try {
                    // Cargar IDs de favoritos desde AsyncStorage
                    const favsJSON = await AsyncStorage.getItem('favorites');
                    const currentFavoriteIds = favsJSON ? JSON.parse(favsJSON) : [];

                    // Cargar todas las recetas desde Firebase (si aún no se han cargado)
                    let recipesToFilter = allRecipes;
                    if (recipesToFilter.length === 0) {
                        const querySnapshot = await getDocs(collection(db, "recipes"));
                        const recipesData = querySnapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        })) as Recipe[];
                        setAllRecipes(recipesData);
                        recipesToFilter = recipesData;
                    }
                    
                    // Filtrar para mostrar solo los favoritos
                    const favRecipes = recipesToFilter.filter(recipe => currentFavoriteIds.includes(recipe.id));
                    setFavoriteRecipes(favRecipes);

                } catch (e) {
                    console.error("Failed to load favorites.", e);
                } finally {
                    setLoading(false);
                }
            };
            loadData();
        }, [allRecipes]) // Dependencia para recargar si las recetas base cambian
    );

    const toggleFavorite = async (recipeId: string) => {
        // En esta pantalla, quitar de favoritos siempre
        const updatedFavoriteIds = favoriteRecipes.map(r => r.id).filter(id => id !== recipeId);
        const updatedFavoriteRecipes = favoriteRecipes.filter(recipe => recipe.id !== recipeId);
        
        setFavoriteRecipes(updatedFavoriteRecipes);
        await AsyncStorage.setItem('favorites', JSON.stringify(updatedFavoriteIds));
    };

    const handleStartCooking = (recipeId: string) => {
        handleCloseModal();
        router.push({ pathname: "/cookingMode", params: { recipeId } });
    };

    const handleOpenModal = (recipe: Recipe) => { setSelectedRecipe(recipe); setModalVisible(true); };
    const handleCloseModal = () => { setModalVisible(false); setSelectedRecipe(null); };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            {loading ? (
                <View style={styles.loaderContainer}><ActivityIndicator size="large" color={Colors.theme.primary} /></View>
            ) : (
                <FlatList
                    data={favoriteRecipes}
                    renderItem={({ item }) => (
                        <RecipeCard 
                            item={item} 
                            onPress={() => handleOpenModal(item)}
                            onToggleFavorite={() => toggleFavorite(item.id)}
                            isFavorite={true} // Siempre son favoritos en esta pantalla
                        />
                    )}
                    keyExtractor={item => item.id}
                    numColumns={2}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        <Text style={styles.headerTitle}>Mis Favoritos</Text>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <FontAwesome name="star-o" size={40} color={Colors.theme.grey} />
                            <Text style={styles.emptyText}>Aún no has guardado recetas.</Text>
                            <Text style={styles.emptySubText}>¡Toca la estrella en una receta para añadirla!</Text>
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

const { width } = Dimensions.get('window');
const cardWidth = (width / 2) - 25;

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
        paddingTop: 60 
    },
    headerTitle: { 
        fontSize: 34, 
        fontWeight: 'bold', 
        color: Colors.theme.text, 
        marginBottom: 15, 
        paddingHorizontal: 5 
    },
    cardWrapper: {
        width: cardWidth,
        margin: 5,
    },
    cardContainer: { 
        width: '100%', 
        height: 250, 
        borderRadius: 15, 
        backgroundColor: Colors.theme.card, 
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        justifyContent: 'flex-end',
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
        fontSize: 18, 
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
