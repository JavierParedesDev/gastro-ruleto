import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
            router.replace('/(tabs)'); 
        } catch (error: any) { 
            Alert.alert("Error en el Login", "El correo o la contraseña son incorrectos."); 
        }
        finally { setLoading(false); }
    };

    return (
        <LinearGradient
            colors={[Colors.theme.secondary, Colors.theme.primary]}
            style={styles.gradientContainer}
        >
            <View style={styles.card}>
                <TouchableOpacity style={styles.closeButton} onPress={() => router.replace('/(tabs)')}>
                    <FontAwesome name="close" size={24} color={Colors.theme.grey} />
                </TouchableOpacity>

                <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
                <Text style={styles.title}>Bienvenido de Vuelta</Text>
                <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
                
                <TextInput 
                    style={styles.input} 
                    placeholder="Correo Electrónico" 
                    placeholderTextColor={Colors.theme.grey}
                    value={email} 
                    onChangeText={setEmail} 
                    keyboardType="email-address" 
                    autoCapitalize="none" 
                />
                <TextInput 
                    style={styles.input} 
                    placeholder="Contraseña" 
                    placeholderTextColor={Colors.theme.grey}
                    value={password} 
                    onChangeText={setPassword} 
                    secureTextEntry 
                />
                
                {loading ? <ActivityIndicator size="large" color={Colors.theme.primary} style={{marginVertical: 20}}/> : (
                    <TouchableOpacity style={styles.button} onPress={handleLogin}>
                        <Text style={styles.buttonText}>Ingresar</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={{marginTop: 25}}>
                    <Text style={styles.linkText}>¿No tienes una cuenta? <Text style={styles.linkTextBold}>Regístrate</Text></Text>
                </TouchableOpacity>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradientContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
    },
    closeButton: {
        position: 'absolute',
        top: 15,
        right: 15,
    },
    logo: {
        width: 80,
        height: 80,
        marginBottom: 15,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.theme.text,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.theme.grey,
        marginBottom: 30,
    },
    input: {
        width: '100%',
        height: 50,
        backgroundColor: '#f0f2f5',
        borderRadius: 10,
        paddingHorizontal: 15,
        marginBottom: 15,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e5e5e5'
    },
    button: {
        width: '100%',
        backgroundColor: Colors.theme.primary,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    linkText: {
        color: Colors.theme.grey,
        textAlign: 'center',
    },
    linkTextBold: {
        color: Colors.theme.primary,
        fontWeight: 'bold',
    }
});
