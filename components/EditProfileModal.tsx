import { FontAwesome } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';

interface EditProfileModalProps {
    visible: boolean;
    onClose: () => void;
    onProfileUpdate: () => void;
}

export const EditProfileModal = ({ visible, onClose, onProfileUpdate }: EditProfileModalProps) => {
    const { user, fetchUserProfile } = useAuth();
    const [name, setName] = useState('');
    const [lastName, setLastName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [description, setDescription] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setLastName(user.lastName || '');
            setBirthDate(user.birthDate || '');
            setDescription(user.description || '');
            setImageUri(user.photoURL || null);
        }
    }, [user, visible]);

    const pickImage = async (fromCamera: boolean) => {
        let result;
        if (fromCamera) {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (permissionResult.granted === false) {
                Alert.alert("Permiso denegado", "Necesitas conceder permisos de cámara para tomar una foto.");
                return;
            }
            result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
        } else {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (permissionResult.granted === false) {
                Alert.alert("Permiso denegado", "Necesitas conceder permisos de galería para seleccionar una imagen.");
                return;
            }
            result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
        }

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
        }
    };

    const handleSaveChanges = async () => {
        if (!user) return;
        
        setIsSubmitting(true);
        const updatedData: { [key: string]: any } = {};
        
        // Comprobar y añadir solo los campos modificados
        if (name.trim() && name.trim() !== user.name) updatedData.name = name.trim();
        if (lastName.trim() && lastName.trim() !== user.lastName) updatedData.lastName = lastName.trim();
        if (birthDate && birthDate !== user.birthDate) updatedData.birthDate = birthDate;
        if (description.trim() !== (user.description || '')) updatedData.description = description.trim();

        // Subir la imagen solo si ha cambiado
        if (imageUri && imageUri !== user.photoURL) {
            try {
                const response = await fetch(imageUri);
                const blob = await response.blob();
                const storage = getStorage();
                const storageRef = ref(storage, `profile_pictures/${user.uid}/profile.jpg`);
                await uploadBytes(storageRef, blob);
                updatedData.photoURL = await getDownloadURL(storageRef);
            } catch (e) {
                Alert.alert("Error", "No se pudo subir la nueva imagen.");
                setIsSubmitting(false);
                return;
            }
        }

        if (Object.keys(updatedData).length === 0) {
            Alert.alert("Sin cambios", "No has realizado ningún cambio en tu perfil.");
            setIsSubmitting(false);
            return;
        }

        try {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, updatedData);
            await fetchUserProfile(user.uid);
            onProfileUpdate();
            Alert.alert("¡Éxito!", "Tu perfil ha sido actualizado.");
            onClose();
        } catch (error) {
            console.error("Error updating profile: ", error);
            Alert.alert("Error", "No se pudo actualizar tu perfil.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setDate(selectedDate);
            const tempDate = new Date(selectedDate);
            const formattedDate = tempDate.getDate().toString().padStart(2, '0') + '/' + (tempDate.getMonth() + 1).toString().padStart(2, '0') + '/' + tempDate.getFullYear();
            setBirthDate(formattedDate);
        }
    };

    return (
        <Modal animationType="slide" transparent={false} visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Editar Perfil</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <FontAwesome name="close" size={24} color={Colors.theme.text} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.contentContainer}>
                        <View style={styles.profilePicContainer}>
                            <Image source={{ uri: imageUri || 'https://placehold.co/150x150/FFDDC9/FF5C00?text=Foto' }} style={styles.profileImage} />
                            <View style={styles.picButtonsContainer}>
                                <TouchableOpacity style={styles.picButton} onPress={() => pickImage(false)}><FontAwesome name="photo" size={20} color={Colors.theme.primary} /><Text style={styles.picButtonText}>Galería</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.picButton} onPress={() => pickImage(true)}><FontAwesome name="camera" size={20} color={Colors.theme.primary} /><Text style={styles.picButtonText}>Cámara</Text></TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Nombre</Text>
                            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Tu nombre" />
                        </View>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Apellido</Text>
                            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Tu apellido" />
                        </View>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Biografía</Text>
                            <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Cuéntanos algo sobre ti..." multiline />
                        </View>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Fecha de Nacimiento</Text>
                            <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                                <Text style={[styles.input, { color: birthDate ? Colors.theme.text : '#C7C7CD' }]}>{birthDate || 'Seleccionar fecha'}</Text>
                            </TouchableOpacity>
                        </View>

                        {showDatePicker && (
                            <DateTimePicker value={date} mode="date" display="spinner" onChange={onDateChange} maximumDate={new Date()} />
                        )}

                        <TouchableOpacity style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]} onPress={handleSaveChanges} disabled={isSubmitting}>
                            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar Cambios</Text>}
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.theme.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: Colors.theme.card },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    closeButton: { padding: 5 },
    contentContainer: { padding: 20 },
    profilePicContainer: { alignItems: 'center', marginBottom: 30 },
    profileImage: { width: 120, height: 120, borderRadius: 60, marginBottom: 15, backgroundColor: '#e0e0e0' },
    picButtonsContainer: { flexDirection: 'row' },
    picButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.theme.card, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, marginHorizontal: 10 },
    picButtonText: { marginLeft: 8, fontWeight: '600', color: Colors.theme.primary },
    inputContainer: { marginBottom: 20 },
    label: { fontSize: 16, fontWeight: '500', color: Colors.theme.grey, marginBottom: 8 },
    input: { backgroundColor: Colors.theme.card, padding: 15, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: '#ddd' },
    textArea: { height: 100, textAlignVertical: 'top' },
    saveButton: { backgroundColor: Colors.theme.primary, padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20 },
    saveButtonDisabled: { backgroundColor: Colors.theme.grey },
    saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
