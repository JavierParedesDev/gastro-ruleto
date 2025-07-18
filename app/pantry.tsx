import { Colors } from '@/constants/Colors';
import { db } from '@/firebaseConfig';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, getDocs } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
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

// --- Componente de la Tarjeta de Receta ---
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
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.cardCategory}>{item.category}</Text>
                </View>
                <TouchableOpacity onPress={onToggleFavorite} style={styles.favoriteButton}>
                    <FontAwesome name={isFavorite ? 'star' : 'star-o'} size={22} color={isFavorite ? Colors.theme.primary : 'white'} />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
};

// --- Pantalla Principal de Mi Despensa ---
export default function PantryScreen() {
    const router = useRouter();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
    const [allIngredients, setAllIngredients] = useState<string[]>([]);
    const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

    useFocusEffect(
        useCallback(() => {
            const loadFavorites = async () => {
                try {
                    const favsJSON = await AsyncStorage.getItem('favorites');
                    setFavorites(favsJSON ? JSON.parse(favsJSON) : []);
                } catch (e) { console.error("Failed to load favorites.", e); }
            };
            loadFavorites();
        }, [])
    );

    const toggleFavorite = async (recipeId: string) => {
        const updatedFavorites = favorites.includes(recipeId)
            ? favorites.filter(id => id !== recipeId)
            : [...favorites, recipeId];
        setFavorites(updatedFavorites);
        await AsyncStorage.setItem('favorites', JSON.stringify(updatedFavorites));
    };

    const toggleIngredient = (ingredient: string) => {
        setSelectedIngredients(prev => 
            prev.includes(ingredient) 
                ? prev.filter(i => i !== ingredient) 
                : [...prev, ingredient]
        );
    };

    useEffect(() => {
        if (selectedIngredients.length === 0) {
            setFilteredRecipes([]);
            return;
        }
        const result = recipes.filter(recipe => 
            selectedIngredients.every(selIng => 
                recipe.ingredients?.some(recIng => recIng.toLowerCase().includes(selIng.toLowerCase()))
            )
        );
        setFilteredRecipes(result);
    }, [selectedIngredients, recipes]);

    useEffect(() => {
        const fetchRecipesAndIngredients = async () => {
            setLoading(true);
            try {
                const querySnapshot = await getDocs(collection(db, "recipes"));
                const recipesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Recipe[];
                setRecipes(recipesData);

                const commonIngredients = ['cebolla', 'ajo', 'papa', 'carne', 'choclo', 'zapallo', 'zanahoria', 'tomate', 'huevo', 'arroz', 'pollo', 'queso', 'harina', 'leche', 'pimentón'];
                setAllIngredients(commonIngredients.sort());

            } catch (error) {
                console.error("Error fetching recipes: ", error);
            } finally {
                setLoading(false);
            }
        };
        fetchRecipesAndIngredients();
    }, []);

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
                    data={filteredRecipes}
                    renderItem={({ item }) => (
                        <RecipeCard 
                            item={item} 
                            onPress={() => handleOpenModal(item)} 
                            onToggleFavorite={() => toggleFavorite(item.id)}
                            isFavorite={favorites.includes(item.id)}
                        />
                    )}
                    keyExtractor={item => item.id}
                    numColumns={2}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        <>
                            <Text style={styles.headerTitle}>Mi Despensa</Text>
                            <Text style={styles.headerSubtitle}>Selecciona los ingredientes que tienes y te diremos qué puedes cocinar.</Text>
                            <View style={styles.ingredientsContainer}>
                                {allIngredients.map(ingredient => (
                                    <TouchableOpacity 
                                        key={ingredient} 
                                        style={[styles.ingredientChip, selectedIngredients.includes(ingredient) && styles.ingredientChipSelected]} 
                                        onPress={() => toggleIngredient(ingredient)}
                                    >
                                        <Text style={[styles.ingredientText, selectedIngredients.includes(ingredient) && styles.ingredientTextSelected]}>{ingredient}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {selectedIngredients.length > 0 && (
                                <Text style={styles.resultsTitle}>
                                    {`Recetas encontradas: ${filteredRecipes.length}`}
                                </Text>
                            )}
                        </>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <FontAwesome name="search" size={40} color={Colors.theme.grey} />
                            <Text style={styles.emptyText}>
                                {selectedIngredients.length === 0 
                                    ? "Selecciona un ingrediente para empezar." 
                                    : "No se encontraron recetas con esa combinación."}
                            </Text>
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
    },
    headerTitle: { 
        fontSize: 34, 
        fontWeight: 'bold', 
        color: Colors.theme.text, 
        marginBottom: 5, 
        marginTop: 60, 
        paddingHorizontal: 5 
    },
    headerSubtitle: {
        fontSize: 16,
        color: Colors.theme.grey,
        marginBottom: 20,
        paddingHorizontal: 5,
    },
    ingredientsContainer: { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        paddingBottom: 10, 
        justifyContent: 'center' 
    },
    ingredientChip: { 
        backgroundColor: Colors.theme.card, 
        paddingVertical: 10, 
        paddingHorizontal: 18, 
        borderRadius: 20, 
        margin: 5,
        borderWidth: 1,
        borderColor: '#eee',
    },
    ingredientChipSelected: { 
        backgroundColor: Colors.theme.primary,
        borderColor: Colors.theme.primary,
    },
    ingredientText: { 
        color: Colors.theme.text, 
        textTransform: 'capitalize', 
        fontSize: 14,
        fontWeight: '500',
    },
    ingredientTextSelected: { 
        color: Colors.theme.textLight, 
        fontWeight: 'bold' 
    },
    resultsTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.theme.text,
        paddingHorizontal: 5,
        marginTop: 20,
        marginBottom: 10,
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
        marginTop: 30, 
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: { 
        fontSize: 16, 
        color: Colors.theme.grey,
        fontWeight: '600',
        marginTop: 15,
        textAlign: 'center',
    },
});
