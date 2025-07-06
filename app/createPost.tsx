import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';

interface Duel {
    id: string;
    title: string;
}

export default function CreatePostScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [postType, setPostType] = useState<'recipe' | 'story'>('recipe');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeDuel, setActiveDuel] = useState<Duel | null>(null);
    const [participateInDuel, setParticipateInDuel] = useState(false);

    useEffect(() => {
        const findActiveDuel = async () => {
            const duelsRef = collection(db, "duels");
            const q = query(duelsRef, where("isActive", "==", true));
            const duelSnapshot = await getDocs(q);
            if (!duelSnapshot.empty) {
                setActiveDuel({ id: duelSnapshot.docs[0].id, ...duelSnapshot.docs[0].data() } as Duel);
            }
        };
        findActiveDuel();
    }, []);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
        });
        if (!result.canceled) setImageUri(result.assets[0].uri);
    };

    const handleSubmit = async () => {
        if (!title || !imageUri) {
            return Alert.alert("Campos incompletos", "Por favor, añade un título y una imagen para tu publicación.");
        }
        if (!user) return;

        setLoading(true);
        try {
            // 1. Subir la imagen a Storage
            const response = await fetch(imageUri);
            const blob = await response.blob();
            const storage = getStorage();
            const storageRef = ref(storage, `community_posts/${user.uid}_${Date.now()}.jpg`);
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);

            // 2. Guardar los datos de la publicación en Firestore
            await addDoc(collection(db, "posts"), {
                type: postType,
                title,
                description,
                image: downloadURL,
                authorId: user.uid,
                authorName: `${user.name} ${user.lastName}`,
                authorPhoto: user.photoURL || '',
                createdAt: serverTimestamp(),
                likes: [],
                duelId: participateInDuel && activeDuel ? activeDuel.id : null,
            });

            Alert.alert("¡Éxito!", "Tu publicación ha sido compartida.");
            router.back();

        } catch (error) {
            console.error("Error al compartir:", error);
            Alert.alert("Error", "No se pudo compartir tu publicación.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Stack.Screen options={{ title: "Crear Publicación" }} />
            <Text style={styles.title}>Comparte tu Sazón</Text>
            
            <View style={styles.typeSelector}>
                <TouchableOpacity onPress={() => setPostType('recipe')} style={[styles.typeButton, postType === 'recipe' && styles.typeButtonActive]}>
                    <Text style={[styles.typeButtonText, postType === 'recipe' && styles.typeButtonTextActive]}>Publicación de Receta</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPostType('story')} style={[styles.typeButton, postType === 'story' && styles.typeButtonActive]}>
                    <Text style={[styles.typeButtonText, postType === 'story' && styles.typeButtonTextActive]}>Momento</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImage} /> : (<><FontAwesome name="camera" size={24} color={Colors.theme.primary} /><Text style={styles.imagePickerText}>Añadir Foto Principal</Text></>)}
            </TouchableOpacity>

            <Text style={styles.label}>{postType === 'recipe' ? 'Nombre de tu plato' : 'Título de tu Historia'}</Text>
            <TextInput style={styles.input} placeholder={postType === 'recipe' ? 'Ej: Mi plato de cazuela ' : 'Ej: Un asado con los amigos'} value={title} onChangeText={setTitle} />
            
            <Text style={styles.label}>{postType === 'recipe' ? 'Descripción o secreto' : 'Cuéntanos tu historia...'}</Text>
            <TextInput style={[styles.input, {height: 100}]} placeholder="Añade una descripción..." value={description} onChangeText={setDescription} multiline />

            {activeDuel && (
                <View style={styles.duelContainer}>
                    <Text style={styles.duelText}>Participar en: "{activeDuel.title}"</Text>
                    <Switch
                        trackColor={{ false: "#767577", true: Colors.theme.accent }}
                        thumbColor={participateInDuel ? "#f4f3f4" : "#f4f3f4"}
                        onValueChange={setParticipateInDuel}
                        value={participateInDuel}
                    />
                </View>
            )}

            <TouchableOpacity style={[styles.submitButton, loading && {backgroundColor: Colors.theme.grey}]} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.submitButtonText}>Publicar</Text>}
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: Colors.theme.background },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
    typeSelector: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#eee', borderRadius: 10, overflow: 'hidden' },
    typeButton: { flex: 1, padding: 12, alignItems: 'center' },
    typeButtonActive: { backgroundColor: Colors.theme.primary },
    typeButtonText: { color: Colors.theme.text, fontWeight: '600' },
    typeButtonTextActive: { color: 'white' },
    label: { fontSize: 16, fontWeight: '600', color: Colors.theme.grey, marginTop: 15, marginBottom: 5 },
    input: { height: 50, borderColor: '#ddd', borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, fontSize: 16, backgroundColor: '#fff' },
    imagePicker: { height: 200, width: '100%', backgroundColor: '#f0f2f5', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    previewImage: { width: '100%', height: '100%', borderRadius: 10 },
    imagePickerText: { marginTop: 8, color: Colors.theme.primary, fontWeight: 'bold' },
    duelContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e8f5e9', padding: 15, borderRadius: 10, marginTop: 20 },
    duelText: { flex: 1, fontSize: 16, color: Colors.theme.accent, fontWeight: 'bold' },
    submitButton: { backgroundColor: Colors.theme.accent, padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 30, marginBottom: 50 },
    submitButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
