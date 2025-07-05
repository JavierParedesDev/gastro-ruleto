import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { login } = useAuth();

    const handleLogin = async () => {
        if (!email || !password) return Alert.alert("Error", "Por favor, ingresa tu correo y contraseña.");
        setLoading(true);
        try {
            await login(email, password);
        } catch (error: any) { Alert.alert("Error en el Login", error.message); }
        finally { setLoading(false); }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Iniciar Sesión</Text>
            <TextInput style={styles.input} placeholder="Correo Electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
            
            {loading ? <ActivityIndicator size="large" color={Colors.theme.primary} /> : (
                <TouchableOpacity style={styles.button} onPress={handleLogin}>
                    <Text style={styles.buttonText}>Ingresar</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                <Text style={styles.linkText}>¿No tienes una cuenta? Regístrate</Text>
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
