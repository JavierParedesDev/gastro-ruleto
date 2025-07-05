import { Colors } from '@/constants/Colors';
import { db } from '@/firebaseConfig';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, getDocs } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

// --- Componente de la Lista de Compras ---
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

// --- Modal para seleccionar recetas (Rediseñado) ---
const RecipePickerModal = ({ visible, onClose, recipes, onSelect }: { visible: boolean, onClose: () => void, recipes: Recipe[], onSelect: (recipe: Recipe) => void }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const filteredRecipes = recipes.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
                    <FlatList
                        data={filteredRecipes}
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
                    />
                </View>
            </TouchableOpacity>
        </Modal>
    );
};


// --- Pantalla del Planificador ---
export default function PlannerScreen() {
    const [plan, setPlan] = useState<Plan>({});
    const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'planner' | 'shoppingList'>('planner');
    const [isPickerVisible, setPickerVisible] = useState(false);
    const [planningSlot, setPlanningSlot] = useState<{ day: string, meal: string } | null>(null);
    
    const daysOfWeek = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

    const loadPlanAndRecipes = async () => {
        setLoading(true);
        try {
            const planJSON = await AsyncStorage.getItem('weeklyPlan');
            if (planJSON) setPlan(JSON.parse(planJSON));

            if (allRecipes.length === 0) {
                const querySnapshot = await getDocs(collection(db, "recipes"));
                const recipesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Recipe[];
                setAllRecipes(recipesData);
            }
        } catch (e) {
            console.error("Failed to load data.", e);
        } finally {
            setLoading(false);
        }
    };
    
    useFocusEffect(useCallback(() => { loadPlanAndRecipes(); }, []));

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
                    <FlatList
                        data={daysOfWeek}
                        keyExtractor={item => item}
                        contentContainerStyle={{paddingBottom: 80}}
                        renderItem={({item: day}) => (
                            <View style={styles.dayContainer}>
                            
                                <Text style={styles.dayTitle}>{day}</Text>



                                <View style={styles.mealSlot}>
                                    <Text style={styles.mealTitle}>Desayuno</Text>
                                    {plan[day]?.Desayuno ? (
                                        <View style={styles.mealPlanned}>
                                            <Image source={{uri: plan[day].Desayuno!.image || 'https://placehold.co/100x100/FFDDC9/FF5C00?text=🍲'}} style={styles.mealImage} />
                                            <Text style={styles.mealRecipe}>{plan[day].Desayuno!.name}</Text>
                                            <TouchableOpacity onPress={() => handleRemoveRecipe(day, 'Desayuno')}><FontAwesome name="times-circle" size={24} color={Colors.theme.grey} /></TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity style={styles.addButton} onPress={() => handleOpenPicker(day, 'Desayuno')}><FontAwesome name="plus" size={16} color={Colors.theme.primary} /><Text style={styles.addButtonText}>Añadir Desayuno</Text></TouchableOpacity>
                                    )}

                                </View>
                                <View style={styles.mealSlot}>
                                    <Text style={styles.mealTitle}>Almuerzo</Text>
                                    {plan[day]?.Almuerzo ? (
                                        <View style={styles.mealPlanned}>
                                            <Image source={{uri: plan[day].Almuerzo!.image || 'https://placehold.co/100x100/FFDDC9/FF5C00?text=🍲'}} style={styles.mealImage} />
                                            <Text style={styles.mealRecipe}>{plan[day].Almuerzo!.name}</Text>
                                            <TouchableOpacity onPress={() => handleRemoveRecipe(day, 'Almuerzo')}><FontAwesome name="times-circle" size={24} color={Colors.theme.grey} /></TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity style={styles.addButton} onPress={() => handleOpenPicker(day, 'Almuerzo')}><FontAwesome name="plus" size={16} color={Colors.theme.primary} /><Text style={styles.addButtonText}>Añadir Almuerzo</Text></TouchableOpacity>
                                    )}
                                </View>
                                <View style={styles.mealSlot}>
                                    <Text style={styles.mealTitle}>Once</Text>
                                    {plan[day]?.Once ? (
                                        <View style={styles.mealPlanned}>
                                            <Image source={{uri: plan[day].Once!.image || 'https://placehold.co/100x100/FFDDC9/FF5C00?text=🍲'}} style={styles.mealImage} />
                                            <Text style={styles.mealRecipe}>{plan[day].Once!.name}</Text>
                                            <TouchableOpacity onPress={() => handleRemoveRecipe(day, 'Once')}><FontAwesome name="times-circle" size={24} color={Colors.theme.grey} /></TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity style={styles.addButton} onPress={() => handleOpenPicker(day, 'Once')}><FontAwesome name="plus" size={16} color={Colors.theme.primary} /><Text style={styles.addButtonText}>Añadir Once</Text></TouchableOpacity>
                                    )}
                                </View>

                                <View style={styles.mealSlot}>
                                    <Text style={styles.mealTitle}>Cena</Text>
                                    {plan[day]?.Cena ? (
                                        <View style={styles.mealPlanned}>
                                            <Image source={{uri: plan[day].Cena!.image || 'https://placehold.co/100x100/FFDDC9/FF5C00?text=🍲'}} style={styles.mealImage} />
                                            <Text style={styles.mealRecipe}>{plan[day].Cena!.name}</Text>
                                            <TouchableOpacity onPress={() => handleRemoveRecipe(day, 'Cena')}><FontAwesome name="times-circle" size={24} color={Colors.theme.grey} /></TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity style={styles.addButton} onPress={() => handleOpenPicker(day, 'Cena')}><FontAwesome name="plus" size={16} color={Colors.theme.primary} /><Text style={styles.addButtonText}>Añadir Cena</Text></TouchableOpacity>
                                    )}  
                                </View>
                            </View>
                        )}
                    />
                ) : (
                    <ShoppingList plan={plan} />
                )
            )}
            <RecipePickerModal visible={isPickerVisible} onClose={() => setPickerVisible(false)} recipes={allRecipes} onSelect={handleSelectRecipe} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background, paddingTop: 60, paddingHorizontal: 10 },
    headerTitle: { fontSize: 32, fontWeight: 'bold', color: Colors.theme.text, marginBottom: 15, paddingHorizontal: 10 },
    tabContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20, backgroundColor: Colors.theme.card, marginHorizontal: 10, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    tabButton: { flex: 1, paddingVertical: 12, borderRadius: 20 },
    tabButtonActive: { backgroundColor: Colors.theme.primary },
    tabText: { color: Colors.theme.primary, fontWeight: 'bold', textAlign: 'center' },
    tabTextActive: { color: Colors.theme.textLight },
    dayContainer: { backgroundColor: Colors.theme.card, borderRadius: 15, padding: 15, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    dayTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.theme.text, marginBottom: 10 },
    mealSlot: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 10 },
    mealTitle: { fontSize: 14, color: Colors.theme.grey, marginBottom: 8, fontWeight: '500' },
    mealRecipe: { fontSize: 16, color: Colors.theme.text, fontWeight: '600', flex: 1 },
    mealPlanned: { flexDirection: 'row', alignItems: 'center' },
    mealImage: { width: 40, height: 40, borderRadius: 8, marginRight: 10 },
    addButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, justifyContent: 'center', backgroundColor: '#e8f5e9', borderRadius: 10 },
    addButtonText: { color: Colors.theme.accent, fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
    shoppingListContainer: { flex: 1, backgroundColor: Colors.theme.card, margin: 5, borderRadius: 15, padding: 10 },
    shoppingListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    shoppingListText: { fontSize: 16, marginLeft: 15, color: Colors.theme.text, textTransform: 'capitalize' },
    shoppingListTextChecked: { textDecorationLine: 'line-through', color: Colors.theme.grey },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { textAlign: 'center', fontSize: 16, color: Colors.theme.grey },
});

const modalStyles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: 'white',
        height: '85%',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f2f5',
        borderRadius: 10,
        paddingHorizontal: 10,
        marginBottom: 15,
    },
    pickerSearchInput: {
        flex: 1,
        height: 45,
    },
    pickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    pickerItemImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
        marginRight: 15,
    },
    pickerItemTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    pickerItemCategory: {
        fontSize: 12,
        color: Colors.theme.grey,
    },
    closeButton: {
        backgroundColor: Colors.theme.primary,
        padding: 15,
        alignItems: 'center',
        borderRadius: 10,
        marginTop: 10,
    },
    closeButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
