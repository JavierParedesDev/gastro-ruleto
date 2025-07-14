import { FontAwesome } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';

const GENDER_OPTIONS = ["Masculino", "Femenino", "Prefiero no decir"];

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

export default function RegisterScreen() {
    const [name, setName] = useState('');
    const [lastName, setLastName] = useState('');
    const [nickname, setNickname] = useState('');
    const [isCheckingNickname, setIsCheckingNickname] = useState(false);
    const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
    const [email, setEmail] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [gender, setGender] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const router = useRouter();

    const checkNicknameAvailability = async (text: string) => {
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

    const debouncedCheck = useCallback(debounce(checkNicknameAvailability, 300), []);

    const handleNicknameChange = (text: string) => {
        const formatted = text.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        setNickname(formatted);
        setIsCheckingNickname(true);
        setNicknameAvailable(null);
        debouncedCheck(formatted);
    };

    const handleSignUp = async () => {
        if (nicknameAvailable === false) {
            Alert.alert("Nickname no disponible", "Por favor, elige otro nombre de usuario.");
            return;
        }
        if (!name || !lastName || !email || !birthDate || !gender || !password || !confirmPassword || !nickname) {
            Alert.alert("Campos incompletos", "Por favor, rellena todos los campos.");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Error de contraseña", "Las contraseñas no coinciden.");
            return;
        }
        setLoading(true);
        try {
            await register({
                email,
                pass: password,
                name,
                lastName,
                birthDate,
                gender,
                nickname
            });
            router.replace('/(tabs)');
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                Alert.alert("Error de registro", "El correo electrónico ya está en uso.");
            } else {
                Alert.alert("Error de registro", "No se pudo completar el registro.");
            }
        } finally {
            setLoading(false);
        }
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        const currentDate = selectedDate || date;
        setShowDatePicker(Platform.OS === 'ios');
        setDate(currentDate);

        let tempDate = new Date(currentDate);
        let formattedDate = tempDate.getDate().toString().padStart(2, '0') + '/' + (tempDate.getMonth() + 1).toString().padStart(2, '0') + '/' + tempDate.getFullYear();
        setBirthDate(formattedDate);
    };

    const renderNicknameStatusIcon = () => {
        if (isCheckingNickname) {
            return <ActivityIndicator size="small" color="#fff" />;
        }
        if (nicknameAvailable === true) {
            return <FontAwesome name="check-circle" size={20} color={Colors.theme.accent} />;
        }
        if (nicknameAvailable === false) {
            return <FontAwesome name="times-circle" size={20} color={Colors.theme.primary} />;
        }
        return null;
    };

    const renderNicknameMessage = () => {
        if (nickname.length > 0 && nickname.length < 3) {
            return <Text style={styles.errorMessage}>El nickname debe tener al menos 3 caracteres.</Text>;
        }
        if (nicknameAvailable === false) {
            return <Text style={styles.errorMessage}>Este nickname ya está en uso. Por favor, elige otro.</Text>;
        }
        return null;
    };


    return (
        <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=2070&auto=format&fit=crop' }}
            style={styles.container}
        >
            <View style={styles.overlay} />
            <SafeAreaView style={{ flex: 1, width: '100%' }}>
                <TouchableOpacity style={styles.closeButton} onPress={() => router.replace('/(tabs)')}>
                    <FontAwesome name="close" size={24} color="white" />
                </TouchableOpacity>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <BlurView intensity={80} tint="dark" style={styles.card}>
                            <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
                            <Text style={styles.title}>Crear Cuenta</Text>

                            <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor="rgba(255, 255, 255, 0.5)" value={name} onChangeText={setName} />
                            <TextInput style={styles.input} placeholder="Apellido" placeholderTextColor="rgba(255, 255, 255, 0.5)" value={lastName} onChangeText={setLastName} />
                            
                            {/* **Contenedor para el campo de Nickname y su mensaje de error** */}
                            <View style={styles.fieldWrapper}>
                                <View style={styles.inputContainer}>
                                    <TextInput 
                                        style={styles.inputField} 
                                        placeholder="Nickname" 
                                        placeholderTextColor="rgba(255, 255, 255, 0.5)" 
                                        value={nickname} 
                                        onChangeText={handleNicknameChange} 
                                        autoCapitalize="none" 
                                        maxLength={30}
                                    />
                                    <View style={styles.statusIcon}>{renderNicknameStatusIcon()}</View>
                                </View>
                                {renderNicknameMessage()}
                            </View>

                            <TextInput style={styles.input} placeholder="Email" placeholderTextColor="rgba(255, 255, 255, 0.5)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                            <TextInput style={styles.input} placeholder="Contraseña" placeholderTextColor="rgba(255, 255, 255, 0.5)" value={password} onChangeText={setPassword} secureTextEntry />
                            <TextInput style={styles.input} placeholder="Confirmar Contraseña" placeholderTextColor="rgba(255, 255, 255, 0.5)" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

                            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.input}>
                                <Text style={[styles.dateText, !birthDate && styles.placeholder]}>
                                    {birthDate || "Fecha de Nacimiento"}
                                </Text>
                            </TouchableOpacity>

                            {showDatePicker && (
                                <DateTimePicker
                                    testID="dateTimePicker"
                                    value={date}
                                    mode="date"
                                    display="spinner"
                                    onChange={onDateChange}
                                    maximumDate={new Date()}
                                    themeVariant='dark'
                                />
                            )}
                            
                            <View style={styles.genderContainer}>
                                {GENDER_OPTIONS.map(option => (
                                    <TouchableOpacity
                                        key={option}
                                        style={[styles.genderButton, gender === option && styles.genderButtonSelected]}
                                        onPress={() => setGender(option)}
                                    >
                                        <Text style={[styles.genderButtonText, gender === option && styles.genderButtonTextSelected]}>{option}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity style={[styles.button, (loading || nicknameAvailable === false) && styles.buttonDisabled]} onPress={handleSignUp} disabled={loading || nicknameAvailable === false}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Registrarse</Text>}
                            </TouchableOpacity>
                            
                            <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={{marginTop: 20}}>
                                <Text style={styles.linkText}>¿Ya tienes una cuenta? <Text style={styles.linkTextBold}>Ingresar</Text></Text>
                            </TouchableOpacity>
                        </BlurView>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </ImageBackground>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 10,
        padding: 10,
    },
    scrollContent: { 
        flexGrow: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        paddingVertical: 30 
    },
    card: {
        width: '90%',
        maxWidth: 400,
        borderRadius: 20,
        padding: 25,
        overflow: 'hidden',
    },
    logo: {
        width: 80,
        height: 80,
        marginBottom: 15,
        alignSelf: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 20,
        textAlign: 'center',
    },
    fieldWrapper: {
        width: '100%',
        marginBottom: 15,
    },
    input: {
        width: '100%',
        height: 55,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        paddingHorizontal: 20,
        marginBottom: 15,
        fontSize: 16,
        color: 'white',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        height: 55,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    inputField: {
        flex: 1,
        paddingHorizontal: 20,
        fontSize: 16,
        color: 'white',
    },
    statusIcon: {
        paddingHorizontal: 15,
    },
    errorMessage: {
        color: Colors.theme.primary,
        fontSize: 12,
        marginTop: 5,
        marginLeft: 10,
        fontWeight: '600'
    },
    dateText: { color: 'white' },
    placeholder: { color: 'rgba(255, 255, 255, 0.5)' },
    genderContainer: { flexDirection: 'column',gap: 10,justifyContent: 'space-between', marginBottom: 15 },
    genderButton: { paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.2)', flex: 1, marginHorizontal: 4, alignItems: 'center' },
    genderButtonSelected: { backgroundColor: 'rgba(255, 92, 0, 0.4)', borderColor: Colors.theme.primary },
    genderButtonText: { color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' },
    genderButtonTextSelected: { color: 'white' },
    button: {
        width: '100%',
        backgroundColor: Colors.theme.primary,
        padding: 18,
        borderRadius: 15,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: Colors.theme.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
        elevation: 10,
    },
    buttonDisabled: { backgroundColor: '#555' },
    buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    linkText: { marginTop: 25, textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' },
    linkTextBold: { fontWeight: 'bold', color: 'white' },
});
