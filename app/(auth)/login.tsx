import { FontAwesome } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
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
                    style={{ flex: 1, width: '100%', justifyContent: 'center' }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                >
                    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <BlurView intensity={80} tint="dark" style={styles.card}>
                            <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
                            <Text style={styles.title}>Bienvenido</Text>
                            
                            <TextInput 
                                style={styles.input} 
                                placeholder="Email" 
                                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                                value={email} 
                                onChangeText={setEmail} 
                                keyboardType="email-address" 
                                autoCapitalize="none" 
                            />
                            <TextInput 
                                style={styles.input} 
                                placeholder="Contraseña" 
                                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                                value={password} 
                                onChangeText={setPassword} 
                                secureTextEntry 
                            />
                            
                            {loading ? <ActivityIndicator size="large" color="#fff" style={{marginVertical: 20}}/> : (
                                <TouchableOpacity style={styles.button} onPress={handleLogin}>
                                    <Text style={styles.buttonText}>Ingresar</Text>
                                </TouchableOpacity>
                            )}
                            
                            <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={{marginTop: 30}}>
                                <Text style={styles.linkText}>¿No tienes una cuenta? <Text style={styles.linkTextBold}>Regístrate</Text></Text>
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
    card: {
        width: '90%',
        maxWidth: 400,
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        overflow: 'hidden',
    },
    logo: {
        width: 90,
        height: 90,
        marginBottom: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 30,
        textAlign: 'center',
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
    },
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
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    linkText: {
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
    },
    linkTextBold: {
        color: 'white',
        fontWeight: 'bold',
    }
});
