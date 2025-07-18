import { FontAwesome } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';

// --- Interfaces ---
interface Recipe {
    id: string;
    name: string;
    category: string;
    image?: string;
    ingredients?: string[];
    steps?: string;
}

interface RecipeDetailModalProps {
    visible: boolean;
    onClose: () => void;
    recipe: Recipe | null;
}

export const RecipeDetailModal = ({ visible, onClose, recipe }: RecipeDetailModalProps) => {
    const router = useRouter();

    if (!recipe) return null;

    const handleStartCooking = () => {
        onClose();
        // Pequeño retraso para asegurar que el modal se cierre antes de navegar
        setTimeout(() => {
            router.push({ pathname: "/cookingMode", params: { recipeId: recipe.id } });
        }, 100);
    };

    const imageUrl = (recipe.image && typeof recipe.image === 'string' && recipe.image.startsWith('http'))
        ? recipe.image
        : 'https://placehold.co/600x400/FF5C00/FFFFFF?text=Receta';

    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <BlurView intensity={30} tint="dark" style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <Image source={{ uri: imageUrl }} style={styles.modalImage} />
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <FontAwesome name="close" size={24} color={Colors.theme.grey} />
                    </TouchableOpacity>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollView}>
                        <Text style={styles.modalCategory}>{recipe.category}</Text>
                        <Text style={styles.modalTitle}>{recipe.name}</Text>
                        
                        <View style={styles.separator} />

                        <Text style={styles.modalSubtitle}>Ingredientes</Text>
                        {recipe.ingredients?.map((ingredient, index) => (
                            <Text key={index} style={styles.modalText}>• {ingredient}</Text>
                        ))}

                        <View style={styles.separator} />

                        <Text style={styles.modalSubtitle}>Preparación</Text>
                        <Text style={styles.modalText}>{recipe.steps?.replace(/\\n/g, '\n')}</Text>
                    </ScrollView>
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cookButton} onPress={handleStartCooking}>
                            <FontAwesome name="spoon" size={20} color="white" style={{marginRight: 10}} />
                            <Text style={styles.cookButtonText}>Modo Cocina</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </BlurView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '92%',
        height: '85%',
        backgroundColor: Colors.theme.background,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    modalImage: {
        width: '100%',
        height: '40%',
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: 8,
        borderRadius: 20,
    },
    modalScrollView: {
        padding: 20,
    },
    modalCategory: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.theme.primary,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    modalTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.theme.text,
        marginBottom: 15,
    },
    separator: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 15,
    },
    modalSubtitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.theme.text,
        marginBottom: 10,
    },
    modalText: {
        fontSize: 16,
        lineHeight: 24,
        color: Colors.theme.grey,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    cookButton: {
        backgroundColor: Colors.theme.secondary,
        padding: 15,
        borderRadius: 15,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    cookButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
