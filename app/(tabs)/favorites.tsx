import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, getDocs } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { db } from '../../firebaseConfig';

// --- Interfaces ---
interface Recipe {
    id: string;
    name: string;
    category: string;
    image?: string;
    ingredients?: string[];
    steps?: string;
}

// --- Componente Modal ---
const RecipeModal = ({ visible, onClose, recipe, onStartCooking }: { visible: boolean, onClose: () => void, recipe: Recipe | null, onStartCooking: (id: string) => void }) => {
    if (!recipe) return null;
    const imageUrl = (recipe.image && typeof recipe.image === 'string' && recipe.image.startsWith('http'))
        ? recipe.image
        : 'https://placehold.co/600x400/FF5C00/FFFFFF?text=Receta';
    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <View style={modalStyles.modalContainer}><View style={modalStyles.modalContent}><Image source={{ uri: imageUrl }} style={modalStyles.modalImage} /><ScrollView style={modalStyles.modalScrollView}><Text style={modalStyles.modalTitle}>{recipe.name}</Text><Text style={modalStyles.modalSubtitle}>Ingredientes</Text>{recipe.ingredients?.map((ingredient, index) => (<Text key={index} style={modalStyles.modalText}>• {ingredient}</Text>))}<Text style={modalStyles.modalSubtitle}>Preparación</Text><Text style={modalStyles.modalText}>{recipe.steps?.replace(/\\n/g, '\n')}</Text></ScrollView>
            <TouchableOpacity style={modalStyles.cookButton} onPress={() => onStartCooking(recipe.id)}><FontAwesome name="spoon" size={20} color="white" style={{marginRight: 10}} /><Text style={modalStyles.closeButtonText}>Modo Cocina</Text></TouchableOpacity>
            <TouchableOpacity style={modalStyles.closeButton} onPress={onClose}><Text style={modalStyles.closeButtonText}>Cerrar</Text></TouchableOpacity></View></View>
        </Modal>
    );
};

// --- Componente de la Tarjeta de Receta (Rediseñado) ---
const RecipeCard = ({ item, onPress, onToggleFavorite, isFavorite }: { item: Recipe, onPress: () => void, onToggleFavorite: () => void, isFavorite: boolean }) => {
    const imageUrl = (item.image && typeof item.image === 'string' && item.image.startsWith('http'))
        ? item.image
        : 'https://placehold.co/300x200/FFDDC9/FF5C00?text=🍲';
    return (
        <View style={styles.cardContainer}>
            <TouchableOpacity onPress={onPress} style={styles.card}>
                <Image source={{ uri: imageUrl }} style={styles.cardImage} />
                <View style={styles.cardTextContainer}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.cardCategory}>{item.category}</Text>
                </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={onToggleFavorite} style={styles.favoriteButton}>
                <FontAwesome name={isFavorite ? 'star' : 'star-o'} size={22} color={isFavorite ? Colors.theme.primary : Colors.theme.grey} />
            </TouchableOpacity>
        </View>
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
        }, [])
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
            <RecipeModal 
                visible={modalVisible} 
                onClose={handleCloseModal} 
                recipe={selectedRecipe}
                onStartCooking={handleStartCooking}
            />
        </View>
    );
}

const { width } = Dimensions.get('window');
const cardWidth = (width / 2) - 30;

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
        paddingHorizontal: 10,
    },
    headerTitle: { 
        fontSize: 32, 
        fontWeight: 'bold', 
        color: Colors.theme.text, 
        marginBottom: 15, 
        marginTop: 60, 
        paddingHorizontal: 10 
    },
    cardContainer: {
        width: cardWidth,
        margin: 10,
        backgroundColor: Colors.theme.card,
        borderRadius: 15,
        shadowColor: Colors.theme.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    card: {
        width: '100%',
    },
    cardImage: { 
        width: '100%', 
        height: 120, 
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
    },
    cardTextContainer: { 
        padding: 10,
    },
    cardTitle: { 
        fontSize: 16, 
        fontWeight: 'bold', 
        color: Colors.theme.text,
        height: 40,
    },
    cardCategory: { 
        fontSize: 12, 
        color: Colors.theme.grey,
        marginTop: 4,
    },
    favoriteButton: { 
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(255,255,255,0.8)',
        padding: 6,
        borderRadius: 15,
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

const modalStyles = StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalContent: { width: '90%', height: '80%', backgroundColor: 'white', borderRadius: 20, overflow: 'hidden' },
    modalImage: { width: '100%', height: '40%' },
    modalScrollView: { padding: 20 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 15 },
    modalSubtitle: { fontSize: 18, fontWeight: 'bold', marginTop: 10, marginBottom: 5 },
    modalText: { fontSize: 16, lineHeight: 24 },
    cookButton: { backgroundColor: Colors.theme.accent, padding: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
    closeButton: { backgroundColor: Colors.theme.primary, padding: 15, alignItems: 'center' },
    closeButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
