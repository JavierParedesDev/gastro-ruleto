import { FontAwesome } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';

interface EditProfileModalProps {
    visible: boolean;
    onClose: () => void;
    onProfileUpdate: () => void;
}

// --- Hook para la cuenta regresiva ---
const useCountdown = (targetDate: Date | null) => {
    const [timeLeft, setTimeLeft] = useState({
        days: 0, hours: 0, minutes: 0, seconds: 0
    });

    useEffect(() => {
        if (!targetDate) return;

        const interval = setInterval(() => {
            const now = new Date().getTime();
            const distance = targetDate.getTime() - now;

            if (distance < 0) {
                clearInterval(interval);
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
                return;
            }
            
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            setTimeLeft({ days, hours, minutes, seconds });
        }, 1000);

        return () => clearInterval(interval);
    }, [targetDate]);

    return timeLeft;
};


// Debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: Parameters<F>): Promise<ReturnType<F>> =>
        new Promise(resolve => {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => resolve(func(...args)), waitFor);
        });
}

export const EditProfileModal = ({ visible, onClose, onProfileUpdate }: EditProfileModalProps) => {
    const { user, fetchUserProfile } = useAuth();
    const [name, setName] = useState('');
    const [lastName, setLastName] = useState('');
    const [nickname, setNickname] = useState('');
    const [isCheckingNickname, setIsCheckingNickname] = useState(false);
    const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(true);
    const [birthDate, setBirthDate] = useState('');
    const [description, setDescription] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [canChangeNickname, setCanChangeNickname] = useState(false);
    const [targetDate, setTargetDate] = useState<Date | null>(null);
    const countdown = useCountdown(targetDate);

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setLastName(user.lastName || '');
            setNickname(user.nickname || '');
            setBirthDate(user.birthDate || '');
            setDescription(user.description || '');
            setImageUri(user.photoURL || null);
            setNicknameAvailable(true);

            if (user.nicknameLastChanged && user.nicknameLastChanged.toDate) {
                const lastChangedDate = user.nicknameLastChanged.toDate();
                const ninetyDaysLater = new Date(lastChangedDate.getTime());
                ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);

                if (new Date() < ninetyDaysLater) {
                    setCanChangeNickname(false);
                    setTargetDate(ninetyDaysLater);
                } else {
                    setCanChangeNickname(true);
                    setTargetDate(null);
                }
            } else {
                setCanChangeNickname(true);
                setTargetDate(null);
            }
        }
    }, [user, visible]);

    const checkNicknameAvailability = async (text: string) => {
        if (!user || text.toLowerCase() === (user.nickname || '').toLowerCase()) {
            setNicknameAvailable(true);
            setIsCheckingNickname(false);
            return;
        }
        if (text.length < 3) {
            setNicknameAvailable(null);
            setIsCheckingNickname(false);
            return;
        }
        setIsCheckingNickname(true);
        const q = query(collection(db, "nicknames"), where("nickname_lowercase", "==", text.toLowerCase()));
        const querySnapshot = await getDocs(q);
        setNicknameAvailable(querySnapshot.empty);
        setIsCheckingNickname(false);
    };

    // **OPTIMIZACIÓN**: Se reduce el tiempo de espera a 200ms para una respuesta más rápida.
    const debouncedCheck = useCallback(debounce(checkNicknameAvailability, 200), [user]);

    const handleNicknameChange = (text: string) => {
        const formatted = text.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        setNickname(formatted);
        setIsCheckingNickname(true);
        setNicknameAvailable(null);
        debouncedCheck(formatted);
    };

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
        if (nicknameAvailable === false) {
            Alert.alert("Nickname no disponible", "Este nombre de usuario ya está en uso. Por favor, elige otro.");
            return;
        }
        
        setIsSubmitting(true);
        const updatedData: { [key: string]: any } = {};
        const newNickname = nickname.trim().toLowerCase();
        const oldNickname = (user.nickname || '').toLowerCase();
        
        if (name.trim() && name.trim() !== user.name) updatedData.name = name.trim();
        if (lastName.trim() && lastName.trim() !== user.lastName) updatedData.lastName = lastName.trim();
        if (newNickname && newNickname !== oldNickname) {
            updatedData.nickname = newNickname;
            updatedData.nicknameLastChanged = serverTimestamp();
        }
        if (birthDate && birthDate !== user.birthDate) updatedData.birthDate = birthDate;
        if (description.trim() !== (user.description || '')) updatedData.description = description.trim();

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
            const batch = writeBatch(db);
            const userRef = doc(db, "users", user.uid);
            batch.update(userRef, updatedData);

            if (newNickname && newNickname !== oldNickname) {
                if (oldNickname) {
                    const oldNicknameRef = doc(db, "nicknames", oldNickname);
                    batch.delete(oldNicknameRef);
                }
                const newNicknameRef = doc(db, "nicknames", newNickname);
                batch.set(newNicknameRef, { userId: user.uid, nickname_lowercase: newNickname });
            }

            await batch.commit();
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
    
    const renderNicknameStatus = () => {
        if (isCheckingNickname) {
            return <ActivityIndicator size="small" color={Colors.theme.primary} />;
        }
        if (nicknameAvailable === true) {
            return <FontAwesome name="check-circle" size={20} color={Colors.theme.accent} />;
        }
        if (nicknameAvailable === false) {
            return <FontAwesome name="times-circle" size={20} color={Colors.theme.primary} />;
        }
        return null;
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
                            <View style={styles.labelContainer}>
                                <Text style={styles.label}>Nickname</Text>
                                {!canChangeNickname && (
                                    <Text style={styles.cooldownText}>
                                        {`${countdown.days}d ${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`}
                                    </Text>
                                )}
                            </View>
                            <View style={[styles.fieldContainer, !canChangeNickname && styles.disabledInput]}>
                                <TextInput 
                                    style={styles.inputField} 
                                    value={nickname} 
                                    onChangeText={handleNicknameChange} 
                                    placeholder="Tu apodo único" 
                                    autoCapitalize="none"
                                    editable={canChangeNickname}
                                />
                                <View style={styles.statusIcon}>{canChangeNickname && renderNicknameStatus()}</View>
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
                            <View style={styles.labelContainer}>
                                <Text style={styles.label}>Biografía</Text>
                                <Text style={styles.charCounter}>{description.length} / 30</Text>
                            </View>
                            <TextInput 
                                style={[styles.input, styles.textArea]} 
                                value={description} 
                                onChangeText={setDescription} 
                                placeholder="Cuéntanos algo sobre ti..." 
                                multiline 
                                maxLength={30}
                            />
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

                        <TouchableOpacity style={[styles.saveButton, (isSubmitting || nicknameAvailable === false) && styles.saveButtonDisabled]} onPress={handleSaveChanges} disabled={isSubmitting || nicknameAvailable === false}>
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
    labelContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: { fontSize: 16, fontWeight: '500', color: Colors.theme.grey },
    cooldownText: { fontSize: 12, color: Colors.theme.primary, fontWeight: '600' },
    charCounter: {
        fontSize: 12,
        color: Colors.theme.grey,
    },
    input: { backgroundColor: Colors.theme.card, padding: 15, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: '#ddd' },
    fieldContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.theme.card,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    inputField: {
        flex: 1,
        padding: 15,
        fontSize: 16,
    },
    disabledInput: {
        backgroundColor: '#f5f5f5',
        borderColor: '#eee',
    },
    statusIcon: {
        paddingHorizontal: 10,
    },
    textArea: { height: 60, textAlignVertical: 'top' },
    saveButton: { backgroundColor: Colors.theme.primary, padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20 },
    saveButtonDisabled: { backgroundColor: Colors.theme.grey },
    saveButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
