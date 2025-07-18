import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';

interface ButtonConfig {
    text: string;
    onPress: () => void;
    style?: 'primary' | 'destructive' | 'cancel';
}

interface CustomAlertProps {
    visible: boolean;
    title: string;
    message: string;
    buttons: ButtonConfig[];
    onClose: () => void;
}

export const CustomAlert = ({ visible, title, message, buttons, onClose }: CustomAlertProps) => {
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <FontAwesome name="exclamation-triangle" size={40} color={Colors.theme.primary} />
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>
                    <View style={styles.buttonContainer}>
                        {buttons.map((button, index) => {
                            let buttonStyle = styles.buttonPrimary;
                            let textStyle = styles.buttonTextPrimary;

                            if (button.style === 'destructive') {
                                buttonStyle = styles.buttonDestructive;
                                textStyle = styles.buttonTextPrimary;
                            } else if (button.style === 'cancel') {
                                buttonStyle = styles.buttonSecondary;
                                textStyle = styles.buttonTextSecondary;
                            }

                            return (
                                <TouchableOpacity key={index} style={[styles.buttonBase, buttonStyle]} onPress={button.onPress}>
                                    <Text style={textStyle}>{button.text}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
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
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: Colors.theme.grey,
        textAlign: 'center',
        marginBottom: 25,
    },
    buttonContainer: {
        width: '100%',
        flexDirection: 'column-reverse', // Botón primario abajo
    },
    buttonBase: {
        width: '100%',
        padding: 15,
        borderRadius: 15,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonPrimary: {
        backgroundColor: Colors.theme.secondary,
    },
    buttonTextPrimary: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonDestructive: {
        backgroundColor: Colors.theme.primary,
    },
    buttonSecondary: {
        backgroundColor: 'transparent',
    },
    buttonTextSecondary: {
        color: Colors.theme.grey,
        fontSize: 16,
        fontWeight: 'bold',
    },
});
