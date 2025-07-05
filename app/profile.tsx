import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';

export default function ProfileScreen() {
    const { user, logout, fetchUserProfile } = useAuth();
    const [uploading, setUploading] = useState(false);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled && user) {
            uploadImage(result.assets[0].uri, user.uid);
        }
    };

    const uploadImage = async (uri: string, uid: string) => {
        setUploading(true);
        const response = await fetch(uri);
        const blob = await response.blob();
        const storage = getStorage();
        const storageRef = ref(storage, `profile_pictures/${uid}/profile.jpg`);

        try {
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);
            
            const userDocRef = doc(db, "users", uid);
            await updateDoc(userDocRef, { photoURL: downloadURL });
            
            await fetchUserProfile(uid);
            Alert.alert("¡Éxito!", "Tu foto de perfil ha sido actualizada.");
        } catch (error) {
            console.error("Error al subir la imagen:", error);
            Alert.alert("Error", "No se pudo actualizar la foto de perfil.");
        } finally {
            setUploading(false);
        }
    };

    if (!user) {
        return <View style={styles.container}><Text>Cargando perfil...</Text></View>;
    }

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={pickImage} disabled={uploading}>
                <Image 
                    source={{ uri: user.photoURL || 'https://placehold.co/150x150/FFDDC9/FF5C00?text=Foto' }} 
                    style={styles.profileImage} 
                />
                {uploading ? (
                    <View style={styles.uploadingOverlay}>
                        <ActivityIndicator size="large" color="#fff" />
                    </View>
                ) : (
                    <View style={styles.editIconContainer}>
                        <FontAwesome name="camera" size={20} color="white" />
                    </View>
                )}
            </TouchableOpacity>

            <Text style={styles.name}>{user.name} {user.lastName}</Text>
            <Text style={styles.detail}>Edad: {user.age}</Text>
            <Text style={styles.detail}>{user.email}</Text>
            
            <TouchableOpacity style={styles.button} onPress={logout}>
                <Text style={styles.buttonText}>Cerrar Sesión</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.theme.background,
        padding: 20,
    },
    profileImage: {
        width: 150,
        height: 150,
        borderRadius: 75,
        marginBottom: 20,
        borderWidth: 4,
        borderColor: Colors.theme.primary,
    },
    editIconContainer: {
        position: 'absolute',
        bottom: 20,
        right: 10,
        backgroundColor: Colors.theme.primary,
        padding: 8,
        borderRadius: 20,
    },
    uploadingOverlay: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    name: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.theme.text,
    },
    detail: {
        fontSize: 16,
        color: Colors.theme.grey,
        marginTop: 5,
    },
    button: {
        backgroundColor: Colors.theme.primary,
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
        marginTop: 40,
    },
    buttonText: {
        color: Colors.theme.textLight,
        fontSize: 16,
        fontWeight: 'bold',
    },
});
