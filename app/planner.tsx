import { Colors } from '@/constants/Colors';
import { db } from '@/firebaseConfig';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, getDocs, limit, orderBy, query, QueryConstraint, QueryDocumentSnapshot, startAfter, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, ImageBackground, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// --- Interfaces ---
interface Recipe {
    id: string;
    name: string;
    category: string;
    image?: string;
    ingredients?: string[];
    steps?: string;
}

interface Plan {
    [day: string]: {
        [meal: string]: Recipe | null;
    };
}

// --- Componente de la Lista de Compras (sin cambios) ---
const ShoppingList = ({ plan }: { plan: Plan }) => {
    const [shoppingList, setShoppingList] = useState<string[]>([]);
    const [checkedItems, setCheckedItems] = useState<string[]>([]);

    const normalizeIngredient = (ingredient: string): string => {
        const lowerCaseIng = ingredient.toLowerCase();
        const ignoreWords = ['de', 'a', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'gramos', 'gr', 'kg', 'kilo', 'taza', 'tazas', 'cucharada', 'cucharadas', 'cucharadita', 'dientes', 'diente', 'pizca', 'manojo', 'atado', 'vara', 'hojas', 'hoja', 'trozo', 'trozos', 'rebanado', 'picada', 'picado', 'molida', 'entera', 'fresca', 'frescos', 'grandes', 'pequeños', 'medianas', 'o', 'para', 'en', 'cubos', 'tiritas', 'cuadritos', 'gajos', 'partidos'];
        let words = lowerCaseIng.split(' ').filter(word => !ignoreWords.includes(word) && isNaN(parseInt(word)));
        if (lowerCaseIng.includes('aceite')) return 'aceite';
        if (lowerCaseIng.includes('papas')) return 'papas';
        if (lowerCaseIng.includes('cebolla')) return 'cebolla';
        return words.join(' ');
    };

    useEffect(() => {
        const ingredients = new Set<string>();
        Object.values(plan).forEach(dayPlan => {
            Object.values(dayPlan).forEach(recipe => {
                recipe?.ingredients?.forEach(ingredient => {
                    const normalized = normalizeIngredient(ingredient);
                    if (normalized) {
                        ingredients.add(normalized.trim());
                    }
                });
            });
        });
        setShoppingList(Array.from(ingredients).sort());
    }, [plan]);
    
    useEffect(() => {
        const loadCheckedItems = async () => {
            const storedItems = await AsyncStorage.getItem('checkedShoppingItems');
            if (storedItems) {
                setCheckedItems(JSON.parse(storedItems));
            }
        };
        loadCheckedItems();
    }, []);

    const toggleChecked = async (item: string) => {
        const newCheckedItems = checkedItems.includes(item)
            ? checkedItems.filter(i => i !== item)
            : [...checkedItems, item];
        setCheckedItems(newCheckedItems);
        await AsyncStorage.setItem('checkedShoppingItems', JSON.stringify(newCheckedItems));
    };

    return (
        <View style={styles.shoppingListContainer}>
            <FlatList
                data={shoppingList}
                keyExtractor={(item, index) => `${item}-${index}`}
                renderItem={({ item }) => {
                    const isChecked = checkedItems.includes(item);
                    return (
                        <TouchableOpacity style={styles.shoppingListItem} onPress={() => toggleChecked(item)}>
                            <FontAwesome name={isChecked ? "check-square-o" : "square-o"} size={24} color={isChecked ? Colors.theme.accent : Colors.theme.text} />
                            <Text style={[styles.shoppingListText, isChecked && styles.shoppingListTextChecked]}>{item}</Text>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>Tu lista de compras está vacía.</Text></View>}
            />
        </View>
    );
};

// --- Modal para seleccionar recetas (con paginación) ---
const RecipePickerModal = ({ visible, onClose, onSelect }: { visible: boolean, onClose: () => void, onSelect: (recipe: Recipe) => void }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const fetchRecipes = async (loadMore = false) => {
        if (loadingMore || (!hasMore && loadMore)) return;

        if (loadMore) setLoadingMore(true);
        else setLoading(true);

        try {
            const recipesRef = collection(db, "recipes");
            const queryLimit = 10;
            let q;

            const queryConstraints: QueryConstraint[] = [orderBy("name")];
            if (searchQuery) {
                queryConstraints.push(where("name", ">=", searchQuery));
                queryConstraints.push(where("name", "<=", searchQuery + '\uf8ff'));
            }

            if (loadMore && lastVisible) {
                q = query(recipesRef, ...queryConstraints, startAfter(lastVisible), limit(queryLimit));
            } else {
                q = query(recipesRef, ...queryConstraints, limit(queryLimit));
            }

            const snapshot = await getDocs(q);
            const newRecipes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));

            if (snapshot.docs.length < queryLimit) setHasMore(false);
            if (snapshot.docs.length > 0) setLastVisible(snapshot.docs[snapshot.docs.length - 1]);

            if (loadMore) {
                setRecipes(prev => [...prev, ...newRecipes]);
            } else {
                setRecipes(newRecipes);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        if (visible) {
            setRecipes([]);
            setLastVisible(null);
            setHasMore(true);
            fetchRecipes();
        }
    }, [visible, searchQuery]);

    const renderFooter = () => {
        if (loadingMore) return <ActivityIndicator style={{ marginVertical: 20 }} color={Colors.theme.primary} />;
        if (!hasMore) return <Text style={modalStyles.noMoreRecipesText}>No hay más recetas</Text>;
        return null;
    };

    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <TouchableOpacity style={modalStyles.modalOverlay} activeOpacity={1} onPressOut={onClose}>
                <View style={modalStyles.modalContainer}>
                    <View style={modalStyles.modalHeader}>
                        <Text style={modalStyles.modalTitle}>Selecciona una Receta</Text>
                        <TouchableOpacity onPress={onClose}>
                            <FontAwesome name="close" size={24} color={Colors.theme.grey} />
                        </TouchableOpacity>
                    </View>
                    <View style={modalStyles.searchContainer}>
                        <FontAwesome name="search" size={18} color={Colors.theme.grey} style={{marginRight: 10}}/>
                        <TextInput 
                            style={modalStyles.pickerSearchInput}
                            placeholder="Buscar receta..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    {loading && recipes.length === 0 ? <ActivityIndicator size="large" color={Colors.theme.primary} /> : (
                        <FlatList
                            data={recipes}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={modalStyles.pickerItem} onPress={() => onSelect(item)}>
                                    <Image source={{uri: item.image || 'https://placehold.co/100x100/FFDDC9/FF5C00?text=🍲'}} style={modalStyles.pickerItemImage} />
                                    <View>
                                        <Text style={modalStyles.pickerItemTitle}>{item.name}</Text>
                                        <Text style={modalStyles.pickerItemCategory}>{item.category}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            onEndReached={() => fetchRecipes(true)}
                            onEndReachedThreshold={0.5}
                            ListFooterComponent={renderFooter}
                        />
                    )}
                </View>
            </TouchableOpacity>
        </Modal>
    );
};


// --- Pantalla del Planificador (Rediseñada) ---
export default function PlannerScreen() {
    const [plan, setPlan] = useState<Plan>({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'planner' | 'shoppingList'>('planner');
    const [isPickerVisible, setPickerVisible] = useState(false);
    const [planningSlot, setPlanningSlot] = useState<{ day: string, meal: string } | null>(null);
    const [selectedDay, setSelectedDay] = useState('Lunes');
    
    const daysOfWeek = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const meals = ["Desayuno", "Almuerzo", "Once", "Cena"];

    const loadPlan = async () => {
        setLoading(true);
        try {
            const planJSON = await AsyncStorage.getItem('weeklyPlan');
            if (planJSON) setPlan(JSON.parse(planJSON));
        } catch (e) {
            console.error("Failed to load plan.", e);
        } finally {
            setLoading(false);
        }
    };
    
    useFocusEffect(useCallback(() => { loadPlan(); }, []));

    const handleOpenPicker = (day: string, meal: string) => {
        setPlanningSlot({ day, meal });
        setPickerVisible(true);
    };

    const handleSelectRecipe = async (recipe: Recipe) => {
        if (!planningSlot) return;
        const { day, meal } = planningSlot;
        const newPlan = { ...plan, [day]: { ...plan[day], [meal]: recipe } };
        setPlan(newPlan);
        await AsyncStorage.setItem('weeklyPlan', JSON.stringify(newPlan));
        setPickerVisible(false);
    };

    const handleRemoveRecipe = async (day: string, meal: string) => {
        const newPlan = { ...plan, [day]: { ...plan[day], [meal]: null } };
        setPlan(newPlan);
        await AsyncStorage.setItem('weeklyPlan', JSON.stringify(newPlan));
    };

    const renderPlannerContent = () => (
        <ScrollView contentContainerStyle={styles.plannerContent}>
            {meals.map(meal => {
                const plannedRecipe = plan[selectedDay]?.[meal];
                return (
                    <View key={meal} style={styles.mealCard}>
                        {plannedRecipe ? (
                            <ImageBackground 
                                source={{uri: plannedRecipe.image || 'https://placehold.co/600x400/FFDDC9/FF5C00?text=🍲'}} 
                                style={styles.mealImageBackground}
                                imageStyle={{ borderRadius: 15 }}
                            >
                                <View style={styles.mealOverlay}>
                                    <Text style={styles.mealTitle}>{meal}</Text>
                                    <Text style={styles.mealRecipeName}>{plannedRecipe.name}</Text>
                                    <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveRecipe(selectedDay, meal)}>
                                        <FontAwesome name="times" size={16} color="white" />
                                    </TouchableOpacity>
                                </View>
                            </ImageBackground>
                        ) : (
                            <TouchableOpacity style={styles.addMealButton} onPress={() => handleOpenPicker(selectedDay, meal)}>
                                <FontAwesome name="plus-circle" size={30} color={Colors.theme.primary} />
                                <Text style={styles.addMealText}>Añadir {meal}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                );
            })}
        </ScrollView>
    );

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <Text style={styles.headerTitle}>Mi Semana</Text>
            
            <View style={styles.tabContainer}>
                <TouchableOpacity onPress={() => setActiveTab('planner')} style={[styles.tabButton, activeTab === 'planner' && styles.tabButtonActive]}><Text style={[styles.tabText, activeTab === 'planner' && styles.tabTextActive]}>Planificador</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('shoppingList')} style={[styles.tabButton, activeTab === 'shoppingList' && styles.tabButtonActive]}><Text style={[styles.tabText, activeTab === 'shoppingList' && styles.tabTextActive]}>Lista de Compras</Text></TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator size="large" color={Colors.theme.primary} style={{flex: 1}}/> : (
                activeTab === 'planner' ? (
                    <>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysContainer}>
                            {daysOfWeek.map(day => (
                                <TouchableOpacity key={day} onPress={() => setSelectedDay(day)} style={[styles.dayChip, selectedDay === day && styles.dayChipActive]}>
                                    <Text style={[styles.dayText, selectedDay === day && styles.dayTextActive]}>{day}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        {renderPlannerContent()}
                    </>
                ) : (
                    <ShoppingList plan={plan} />
                )
            )}
            <RecipePickerModal visible={isPickerVisible} onClose={() => setPickerVisible(false)} onSelect={handleSelectRecipe} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background, paddingTop: 60 },
    headerTitle: { fontSize: 32, fontWeight: 'bold', color: Colors.theme.text, marginBottom: 15, paddingHorizontal: 20 },
    tabContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20, backgroundColor: Colors.theme.card, marginHorizontal: 20, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    tabButton: { flex: 1, paddingVertical: 12, borderRadius: 20 },
    tabButtonActive: { backgroundColor: Colors.theme.primary },
    tabText: { color: Colors.theme.primary, fontWeight: 'bold', textAlign: 'center' },
    tabTextActive: { color: Colors.theme.textLight },
    daysContainer: { paddingVertical: 10, paddingHorizontal: 20 },
    dayChip: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, backgroundColor: Colors.theme.card, marginRight: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
    dayChipActive: { backgroundColor: Colors.theme.secondary },
    dayText: { color: Colors.theme.text, fontWeight: '600' },
    dayTextActive: { color: Colors.theme.textLight },
    
    // Planner Content Styles
    plannerContent: { paddingHorizontal: 15, paddingBottom: 80 },
    mealCard: {
        height: 120,
        borderRadius: 15,
        marginBottom: 15,
        backgroundColor: Colors.theme.card,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    mealImageBackground: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    mealOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 15,
        padding: 15,
        justifyContent: 'space-between',
    },
    mealTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: 'rgba(255,255,255,0.8)',
        textTransform: 'uppercase',
    },
    mealRecipeName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: 'white',
    },
    removeButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addMealButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 15,
        borderWidth: 2,
        borderColor: '#eee',
        borderStyle: 'dashed',
    },
    addMealText: {
        marginTop: 8,
        fontSize: 16,
        color: Colors.theme.grey,
        fontWeight: '600',
    },

    // Shopping List Styles
    shoppingListContainer: { flex: 1, backgroundColor: Colors.theme.card, marginHorizontal: 10, borderRadius: 15, padding: 10 },
    shoppingListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    shoppingListText: { fontSize: 16, marginLeft: 15, color: Colors.theme.text, textTransform: 'capitalize' },
    shoppingListTextChecked: { textDecorationLine: 'line-through', color: Colors.theme.grey },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { textAlign: 'center', fontSize: 16, color: Colors.theme.grey },
});

const modalStyles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContainer: { backgroundColor: 'white', height: '85%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    modalTitle: { fontSize: 22, fontWeight: 'bold' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f2f5', borderRadius: 10, paddingHorizontal: 10, marginBottom: 15 },
    pickerSearchInput: { flex: 1, height: 45 },
    pickerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
    pickerItemImage: { width: 50, height: 50, borderRadius: 8, marginRight: 15 },
    pickerItemTitle: { fontSize: 16, fontWeight: '600' },
    pickerItemCategory: { fontSize: 12, color: Colors.theme.grey },
    noMoreRecipesText: { textAlign: 'center', padding: 20, color: Colors.theme.grey },
});
