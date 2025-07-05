import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';

export default function RegisterScreen() {
    const [name, setName] = useState('');
    const [lastName, setLastName] = useState('');
    const [age, setAge] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { register } = useAuth();

    const handleRegister = async () => {
        if (!email || !password || !name || !lastName || !age) {
            return Alert.alert("Error", "Por favor, completa todos los campos.");
        }
        setLoading(true);
        try {
            await register(email, password, name, lastName, age);
            // La redirección se maneja automáticamente en el layout principal
        } catch (error: any) {
            Alert.alert("Error en el Registro", error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Crear Cuenta</Text>
            <TextInput style={styles.input} placeholder="Nombre" value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Apellido" value={lastName} onChangeText={setLastName} />
            <TextInput style={styles.input} placeholder="Edad" value={age} onChangeText={setAge} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Correo Electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Contraseña (mínimo 6 caracteres)" value={password} onChangeText={setPassword} secureTextEntry />
            
            {loading ? <ActivityIndicator size="large" color={Colors.theme.primary} /> : (
                <TouchableOpacity style={styles.button} onPress={handleRegister}>
                    <Text style={styles.buttonText}>Registrarse</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.linkText}>¿Ya tienes una cuenta? Inicia sesión</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: Colors.theme.background },
    title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 30, color: Colors.theme.text },
    input: { height: 50, borderColor: '#ddd', borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, marginBottom: 15, fontSize: 16, backgroundColor: '#fff' },
    button: { backgroundColor: Colors.theme.primary, padding: 15, borderRadius: 10, alignItems: 'center', marginVertical: 10 },
    buttonText: { color: Colors.theme.textLight, fontSize: 18, fontWeight: 'bold' },
    linkText: { color: Colors.theme.primary, textAlign: 'center', marginTop: 20 },
});
