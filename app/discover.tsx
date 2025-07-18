import { Colors } from '@/constants/Colors';
import { db } from '@/firebaseConfig';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, getDocs, limit, orderBy, query, QueryDocumentSnapshot, startAfter } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

// --- Componente de Tarjeta para el Carrusel ---
const FeaturedRecipeCard = ({ item, onPress }: { item: Recipe, onPress: () => void }) => {
    const imageUrl = (item.image && typeof item.image === 'string' && item.image.startsWith('http'))
        ? item.image
        : 'https://placehold.co/600x400/FFDDC9/FF5C00?text=🍲';
    return (
        <TouchableOpacity style={styles.featuredCard} onPress={onPress}>
            <Image source={{ uri: imageUrl }} style={styles.featuredImage} />
            <View style={styles.featuredOverlay} />
            <View style={styles.featuredTextContainer}>
                <Text style={styles.featuredTitle}>{item.name}</Text>
                <Text style={styles.featuredCategory}>{item.category}</Text>
            </View>
        </TouchableOpacity>
    );
}

// --- Pantalla Principal de Descubrir (Rediseño Híbrido) ---
export default function DiscoverScreen() {
    const router = useRouter();
    const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
    const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

    const RECIPE_CATEGORIES = ["Almuerzo", "Desayuno", "Once", "Noche", "Break"];

    const fetchRecipes = async (loadMore = false) => {
        if (loadingMore || (!hasMore && loadMore)) return;

        if (loadMore) {
            setLoadingMore(true);
        } else {
            setLoading(true);
            setHasMore(true);
        }

        try {
            const recipesRef = collection(db, "recipes");
            let q;
            const queryLimit = 10;

            if (loadMore && lastVisible) {
                q = query(recipesRef, orderBy("name"), startAfter(lastVisible), limit(queryLimit));
            } else {
                q = query(recipesRef, orderBy("name"), limit(queryLimit));
            }
            
            const querySnapshot = await getDocs(q);
            const recipesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Recipe[];
            
            if (querySnapshot.docs.length > 0) {
                setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
            }

            if (querySnapshot.docs.length < queryLimit) {
                setHasMore(false);
            }

            if (loadMore) {
                setAllRecipes(prev => {
                    const existingIds = new Set(prev.map(r => r.id));
                    const newRecipes = recipesData.filter(r => !existingIds.has(r.id));
                    return [...prev, ...newRecipes];
                });
            } else {
                setAllRecipes(recipesData);
            }

        } catch (error) {
            console.error("Error fetching recipes: ", error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchRecipes();
    }, []);

    // Carga de favoritos
    useFocusEffect(useCallback(() => {
        const loadFavorites = async () => {
            const favsJSON = await AsyncStorage.getItem('favorites');
            setFavorites(favsJSON ? JSON.parse(favsJSON) : []);
        };
        loadFavorites();
    }, []));
    
    // Lógica de filtrado
    useEffect(() => {
        let results = allRecipes;
        if (selectedCategory) {
            results = allRecipes.filter(r => r.category === selectedCategory);
        }
        if (searchQuery) {
            results = results.filter(r =>
                r.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        setFilteredRecipes(results);
    }, [searchQuery, selectedCategory, allRecipes]);

    const handleSelectCategory = (category: string | null) => {
        setSelectedCategory(prev => prev === category ? null : category);
        setSearchQuery('');
    };

    const featuredRecipes = useMemo(() => {
        // Selecciona 5 recetas aleatorias para el carrusel
        return [...allRecipes].sort(() => 0.5 - Math.random()).slice(0, 5);
    }, [allRecipes]);

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
    
    const renderFooter = () => {
        if (loadingMore) {
            return <ActivityIndicator size="large" color={Colors.theme.primary} style={{ marginVertical: 20 }} />;
        }
        if (!hasMore && allRecipes.length > 0) {
            return <Text style={styles.noMoreRecipesText}>¡Has visto todas las recetas!</Text>;
        }
        return null;
    };

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
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    contentContainerStyle={styles.listContent}
                    onEndReached={() => fetchRecipes(true)}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={renderFooter}
                    ListHeaderComponent={
                        <>
                            <Text style={styles.headerTitle}>Descubre</Text>
                            <View style={styles.searchContainer}>
                                <FontAwesome name="search" size={20} color={Colors.theme.grey} style={styles.searchIcon} />
                                <TextInput 
                                    style={styles.searchInput} 
                                    placeholder="Busca tu próxima comida..." 
                                    placeholderTextColor={Colors.theme.grey} 
                                    value={searchQuery} 
                                    onChangeText={setSearchQuery}
                                />
                            </View>

                            {/* Carrusel de Sugerencias */}
                            <Text style={styles.sectionTitle}>Sugerencias para ti</Text>
                            <FlatList
                                data={featuredRecipes}
                                keyExtractor={(item) => item.id}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                renderItem={({ item }) => <FeaturedRecipeCard item={item} onPress={() => handleOpenModal(item)} />}
                                contentContainerStyle={{ paddingHorizontal: 5, paddingBottom: 10 }}
                            />

                            {/* Filtros de Categoría */}
                            <Text style={styles.sectionTitle}>Categorías</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
                                {RECIPE_CATEGORIES.map(cat => (
                                    <TouchableOpacity 
                                        key={cat} 
                                        style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipSelected]}
                                        onPress={() => handleSelectCategory(cat)}
                                    >
                                        <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextSelected]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.sectionTitle}>
                                {selectedCategory ? `Recetas de ${selectedCategory}` : 'Todas las Recetas'}
                            </Text>
                        </>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <FontAwesome name="frown-o" size={40} color={Colors.theme.grey} />
                            <Text style={styles.emptyText}>No se encontraron recetas.</Text>
                            <Text style={styles.emptySubText}>Intenta con otra búsqueda o categoría.</Text>
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

// --- Estilos ---
const { width } = Dimensions.get('window');
const cardWidth = (width / 2) - 25;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: 15, paddingBottom: 40, paddingTop: 60 },
    headerTitle: { fontSize: 34, fontWeight: 'bold', color: Colors.theme.text, marginBottom: 15, paddingHorizontal: 5 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.theme.card, borderRadius: 15, marginBottom: 10, paddingHorizontal: 15, elevation: 2, shadowColor: Colors.theme.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, height: 50, fontSize: 16, color: Colors.theme.text },
    sectionTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.theme.text, marginTop: 20, marginBottom: 10, paddingHorizontal: 5 },
    
    // Estilos del Carrusel
    featuredCard: { width: width * 0.7, height: 200, borderRadius: 15, marginRight: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, justifyContent: 'flex-end' },
    featuredImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', borderRadius: 15 },
    featuredOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 15 },
    featuredTextContainer: { padding: 15 },
    featuredTitle: { fontSize: 18, fontWeight: 'bold', color: 'white' },
    featuredCategory: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

    // Estilos de Categorías
    categoriesContainer: { paddingHorizontal: 5, paddingBottom: 10 },
    categoryChip: { backgroundColor: Colors.theme.card, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#eee' },
    categoryChipSelected: { backgroundColor: Colors.theme.secondary, borderColor: Colors.theme.secondary },
    categoryText: { color: Colors.theme.text, fontWeight: '600' },
    categoryTextSelected: { color: Colors.theme.textLight },

    // Estilos de la Cuadrícula
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
    
    // Estilos de Contenido Vacío
    emptyContainer: { flex: 1, marginTop: '20%', alignItems: 'center', justifyContent: 'center', padding: 20 },
    emptyText: { fontSize: 18, color: Colors.theme.grey, fontWeight: '600', marginTop: 15 },
    emptySubText: { fontSize: 14, color: Colors.theme.grey, marginTop: 5, textAlign: 'center' },
    noMoreRecipesText: {
        textAlign: 'center',
        color: Colors.theme.grey,
        marginVertical: 20,
        fontSize: 16,
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
