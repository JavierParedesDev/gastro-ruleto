import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

export const LoginPromptModal = () => {
    const { isLoginPromptVisible, closeLoginPrompt } = useAuth();
    const router = useRouter();

    if (!isLoginPromptVisible) {
        return null;
    }

    const handleLogin = () => {
        closeLoginPrompt();
        router.push('/(auth)/login');
    };

    const handleRegister = () => {
        closeLoginPrompt();
        router.push('/(auth)/register');
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={isLoginPromptVisible}
            onRequestClose={closeLoginPrompt}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <FontAwesome name="lock" size={40} color={Colors.theme.primary} />
                    <Text style={styles.title}>Función para Miembros</Text>
                    <Text style={styles.message}>
                        Para añadir lugares, calificar o comentar, necesitas iniciar sesión o crear una cuenta.
                    </Text>
                    <TouchableOpacity style={styles.buttonPrimary} onPress={handleLogin}>
                        <Text style={styles.buttonTextPrimary}>Iniciar Sesión</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.buttonSecondary} onPress={handleRegister}>
                        <Text style={styles.buttonTextSecondary}>Crear Cuenta</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={closeLoginPrompt} style={{ marginTop: 15 }}>
                        <Text style={styles.cancelText}>Ahora no</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: '85%',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.theme.text,
        marginTop: 15,
        marginBottom: 10,
    },
    message: {
        fontSize: 16,
        color: Colors.theme.grey,
        textAlign: 'center',
        marginBottom: 25,
    },
    buttonPrimary: {
        width: '100%',
        backgroundColor: Colors.theme.primary,
        padding: 15,
        borderRadius: 15,
        alignItems: 'center',
    },
    buttonTextPrimary: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonSecondary: {
        width: '100%',
        backgroundColor: 'transparent',
        padding: 15,
        borderRadius: 15,
        alignItems: 'center',
        marginTop: 10,
        borderWidth: 1,
        borderColor: Colors.theme.primary,
    },
    buttonTextSecondary: {
        color: Colors.theme.primary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelText: {
        color: Colors.theme.grey,
        fontSize: 14,
        marginTop: 10,
    },
});
