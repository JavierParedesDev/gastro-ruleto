import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';

// --- Interfaces ---
interface Duel {
    id: string;
    title: string;
}

// --- Pantalla de Crear Publicación ---
export default function CreatePostScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [image, setImage] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [activeDuel, setActiveDuel] = useState<Duel | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchActiveDuel = async () => {
            const duelsRef = collection(db, "duels");
            const q = query(duelsRef, where("isActive", "==", true), limit(1));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const duelDoc = snapshot.docs[0];
                setActiveDuel({ id: duelDoc.id, ...duelDoc.data() } as Duel);
            }
        };
        fetchActiveDuel();
    }, []);

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permiso denegado", "Necesitamos acceso a tu galería para seleccionar una imagen.");
            return;
        }
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.7,
        });
        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permiso denegado", "Necesitamos acceso a tu cámara para tomar una foto.");
            return;
        }
        let result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.7,
        });
        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleShare = async () => {
        if (!image || !title.trim() || !user) return;
        setIsSubmitting(true);
        try {
            const response = await fetch(image);
            const blob = await response.blob();
            const storage = getStorage();
            const storageRef = ref(storage, `community_posts/${user.uid}_${Date.now()}.jpg`);
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);

            const postData: any = {
                title: title.trim(),
                description: description.trim(),
                image: downloadURL,
                authorId: user.uid,
                authorName: `${user.name} ${user.lastName}`,
                authorPhoto: user.photoURL,
                likes: [],
                createdAt: serverTimestamp(),
            };

            if (activeDuel) {
                postData.duelId = activeDuel.id;
            }

            await addDoc(collection(db, 'posts'), postData);
            Alert.alert("¡Éxito!", "Tu publicación ha sido compartida en la comunidad.");
            router.back();
        } catch (error) {
            console.error("Error al compartir: ", error);
            Alert.alert("Error", "No se pudo compartir tu publicación.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Text style={styles.headerTitle}>Crear Publicación</Text>
                    
                    {activeDuel && (
                        <View style={styles.duelBanner}>
                            <FontAwesome name="trophy" size={20} color="#FFC107" />
                            <Text style={styles.duelText}>¡Estás participando en el duelo: <Text style={{fontWeight: 'bold'}}>{activeDuel.title}</Text>!</Text>
                        </View>
                    )}

                    <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
                        {image ? (
                            <Image source={{ uri: image }} style={styles.imagePreview} />
                        ) : (
                            <View style={styles.imagePlaceholder}>
                                <FontAwesome name="image" size={50} color={Colors.theme.grey} />
                                <Text style={styles.imagePlaceholderText}>Toca para seleccionar una imagen</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <View style={styles.actionButtonsContainer}>
                        <TouchableOpacity style={styles.actionButton} onPress={handlePickImage}>
                            <FontAwesome name="photo" size={20} color={Colors.theme.primary} />
                            <Text style={styles.actionButtonText}>Galería</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={handleTakePhoto}>
                            <FontAwesome name="camera" size={20} color={Colors.theme.primary} />
                            <Text style={styles.actionButtonText}>Tomar Foto</Text>
                        </TouchableOpacity>
                    </View>

                    <TextInput
                        style={styles.input}
                        placeholder="Título de tu plato..."
                        value={title}
                        onChangeText={setTitle}
                    />
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Añade una descripción..."
                        value={description}
                        onChangeText={setDescription}
                        multiline
                    />

                    <TouchableOpacity 
                        style={[styles.shareButton, (!image || !title.trim()) && styles.shareButtonDisabled]} 
                        onPress={handleShare} 
                        disabled={!image || !title.trim() || isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.shareButtonText}>Compartir</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background },
    scrollContent: { padding: 20, paddingBottom: 40 }, // Added more padding to the bottom
    headerTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    duelBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', padding: 15, borderRadius: 10, marginBottom: 20 },
    duelText: { marginLeft: 10, fontSize: 15, color: '#B45309' },
    imagePicker: { width: '100%', height: 300, backgroundColor: '#f0f2f5', borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 15, overflow: 'hidden' },
    imagePreview: { width: '100%', height: '100%' },
    imagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
    imagePlaceholderText: { marginTop: 10, color: Colors.theme.grey },
    actionButtonsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
    actionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.theme.card, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    actionButtonText: { marginLeft: 10, fontWeight: '600', color: Colors.theme.primary },
    input: { backgroundColor: Colors.theme.card, padding: 15, borderRadius: 10, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
    textArea: { height: 100, textAlignVertical: 'top' },
    shareButton: { backgroundColor: Colors.theme.primary, padding: 15, borderRadius: 10, alignItems: 'center' },
    shareButtonDisabled: { backgroundColor: Colors.theme.grey },
    shareButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
