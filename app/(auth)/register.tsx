import { FontAwesome } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';

const GENDER_OPTIONS = ["Masculino", "Femenino", "Prefiero no decir"];

export default function RegisterScreen() {
    const [name, setName] = useState('');
    const [lastName, setLastName] = useState('');
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

    const handleSignUp = async () => {
        if (!name || !lastName || !email || !birthDate || !gender || !password || !confirmPassword) {
            Alert.alert("Campos incompletos", "Por favor, rellena todos los campos.");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Error de contraseña", "Las contraseñas no coinciden.");
            return;
        }
        setLoading(true);
        try {
            await register(email, password, name, lastName, birthDate, gender);
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

    return (
        <LinearGradient
            colors={[Colors.theme.primary, Colors.theme.secondary]}
            style={styles.container}
        >
            <SafeAreaView style={{ flex: 1 }}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <View style={styles.header}>
                            <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
                            <Text style={styles.title}>Bienvenido a Mi Sazón</Text>
                            <Text style={styles.subtitle}>Crea una cuenta para empezar a compartir</Text>
                        </View>

                        <View style={styles.formContainer}>
                            <View style={styles.inputIconContainer}>
                                <FontAwesome name="user-o" size={20} color={Colors.theme.grey} style={styles.icon} />
                                <TextInput style={styles.input} placeholder="Nombre" value={name} onChangeText={setName} />
                            </View>
                            <View style={styles.inputIconContainer}>
                                <FontAwesome name="user-o" size={20} color={Colors.theme.grey} style={styles.icon} />
                                <TextInput style={styles.input} placeholder="Apellido" value={lastName} onChangeText={setLastName} />
                            </View>
                            <View style={styles.inputIconContainer}>
                                <FontAwesome name="envelope-o" size={20} color={Colors.theme.grey} style={styles.icon} />
                                <TextInput style={styles.input} placeholder="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                            </View>
                            
                            <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                                <View style={styles.inputIconContainer}>
                                    <FontAwesome name="calendar-o" size={20} color={Colors.theme.grey} style={styles.icon} />
                                    <Text style={[styles.input, styles.dateText, !birthDate && styles.placeholder]}>
                                        {birthDate || "Fecha de Nacimiento"}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {showDatePicker && (
                                <DateTimePicker
                                    testID="dateTimePicker"
                                    value={date}
                                    mode="date"
                                    display="spinner"
                                    onChange={onDateChange}
                                    maximumDate={new Date()}
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

                            <View style={styles.inputIconContainer}>
                                <FontAwesome name="lock" size={20} color={Colors.theme.grey} style={styles.icon} />
                                <TextInput style={styles.input} placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
                            </View>
                            <View style={styles.inputIconContainer}>
                                <FontAwesome name="lock" size={20} color={Colors.theme.grey} style={styles.icon} />
                                <TextInput style={styles.input} placeholder="Confirmar contraseña" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
                            </View>

                            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSignUp} disabled={loading}>
                                {loading ? <ActivityIndicator color={Colors.theme.primary} /> : <Text style={styles.buttonText}>Crear Cuenta</Text>}
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                            <Text style={styles.footerText}>¿Ya tienes una cuenta? <Text style={styles.linkText}>Inicia Sesión</Text></Text>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 30 },
    header: { alignItems: 'center', marginBottom: 30 },
    logo: { width: 90, height: 90, marginBottom: 20 },
    title: { fontSize: 26, fontWeight: 'bold', color: 'white', textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
    subtitle: { fontSize: 16, color: 'rgba(255, 255, 255, 0.9)', marginTop: 5 },
    formContainer: { backgroundColor: 'white', borderRadius: 20, padding: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 5 },
    inputIconContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f2f5', borderRadius: 10, marginBottom: 15 },
    icon: { paddingHorizontal: 15 },
    input: { flex: 1, paddingVertical: 15, paddingRight: 15, fontSize: 16, color: Colors.theme.text },
    dateText: { flex: 1, paddingVertical: 15, paddingRight: 15, fontSize: 16 },
    placeholder: { color: '#C7C7CD' },
    genderContainer: { marginBottom: 15 },
    genderOptions: { flexDirection: 'row', justifyContent: 'space-around' },
    genderButton: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1.5, borderColor: '#e0e0e0', flex: 1, marginHorizontal: 4, alignItems: 'center' },
    genderButtonSelected: { backgroundColor: 'rgba(255, 92, 0, 0.1)', borderColor: Colors.theme.primary },
    genderButtonText: { color: Colors.theme.grey, fontWeight: '600', fontSize: 12 },
    genderButtonTextSelected: { color: Colors.theme.primary },
    button: { backgroundColor: 'white', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 10, borderWidth: 2, borderColor: Colors.theme.secondary },
    buttonDisabled: { backgroundColor: '#e0e0e0' },
    buttonText: { color: Colors.theme.primary, fontSize: 16, fontWeight: 'bold' },
    footerText: { marginTop: 25, textAlign: 'center', color: 'white', fontWeight: '500' },
    linkText: { fontWeight: 'bold', textDecorationLine: 'underline' },
});
