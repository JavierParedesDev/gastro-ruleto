import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert("Error en el Registro", error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={[Colors.theme.secondary, Colors.theme.primary]}
            style={styles.gradientContainer}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.card}>
                    <TouchableOpacity style={styles.closeButton} onPress={() => router.replace('/(tabs)')}>
                        <FontAwesome name="close" size={24} color={Colors.theme.grey} />
                    </TouchableOpacity>

                    <Text style={styles.title}>Crea tu Cuenta</Text>
                    <Text style={styles.subtitle}>Únete a la comunidad de Mi Sazón</Text>

                    <TextInput style={styles.input} placeholder="Nombre" value={name} onChangeText={setName} />
                    <TextInput style={styles.input} placeholder="Apellido" value={lastName} onChangeText={setLastName} />
                    <TextInput style={styles.input} placeholder="Edad" value={age} onChangeText={setAge} keyboardType="numeric" />
                    <TextInput style={styles.input} placeholder="Correo Electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                    <TextInput style={styles.input} placeholder="Contraseña (mínimo 6 caracteres)" value={password} onChangeText={setPassword} secureTextEntry />
                    
                    {loading ? <ActivityIndicator size="large" color={Colors.theme.primary} style={{marginVertical: 10}}/> : (
                        <TouchableOpacity style={styles.button} onPress={handleRegister}>
                            <Text style={styles.buttonText}>Registrarse</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={{marginTop: 20}}>
                        <Text style={styles.linkText}>¿Ya tienes una cuenta? <Text style={styles.linkTextBold}>Inicia sesión</Text></Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradientContainer: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
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
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.theme.text,
        marginBottom: 8,
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
        marginTop: 10,
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
