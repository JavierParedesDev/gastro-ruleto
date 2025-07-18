import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { arrayUnion, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';

// --- Interfaces ---
interface Prize { name: string; url: string; }
interface Notification {
    id: string;
    message: string;
    status: 'approved' | 'rejected' | 'follow' | 'gift';
    reason?: string;
    isRead: boolean;
    createdAt: any;
    prize?: Prize;
}

// --- Componente de la Tarjeta de Notificación Rediseñado ---
const NotificationCard = ({ item, onDelete, onAcceptGift }: { item: Notification; onDelete: (id: string) => void; onAcceptGift: (notification: Notification) => void; }) => {
    let iconName: React.ComponentProps<typeof FontAwesome>['name'];
    let iconColor: string;
    let backgroundColor: string;

    switch (item.status) {
        case 'approved':
            iconName = "check";
            iconColor = '#28a745';
            backgroundColor = 'rgba(40, 167, 69, 0.1)';
            break;
        case 'rejected':
            iconName = "times";
            iconColor = '#dc3545';
            backgroundColor = 'rgba(220, 53, 69, 0.1)';
            break;
        case 'follow':
            iconName = "user-plus";
            iconColor = Colors.theme.secondary;
            backgroundColor = 'rgba(0, 123, 255, 0.1)';
            break;
        case 'gift':
            iconName = "gift";
            iconColor = Colors.theme.accent;
            backgroundColor = 'rgba(255, 140, 66, 0.1)';
            break;
        default:
            iconName = "bell";
            iconColor = Colors.theme.grey;
            backgroundColor = '#f8f9fa';
    }

    const date = item.createdAt ? item.createdAt.toDate().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Fecha no disponible';

    return (
        <View style={[styles.card, !item.isRead && styles.cardUnread]}>
            <View style={[styles.iconContainer, { backgroundColor }]}>
                <FontAwesome name={iconName} size={22} color={iconColor} />
            </View>
            <View style={styles.cardTextContainer}>
                <Text style={styles.cardMessage}>{item.message}</Text>
                {item.status === 'rejected' && item.reason && (
                    <Text style={styles.cardReason}>Motivo: {item.reason}</Text>
                )}
                <Text style={styles.cardDate}>{date}</Text>
                {item.status === 'gift' && (
                    <TouchableOpacity style={styles.acceptButton} onPress={() => onAcceptGift(item)}>
                        <Text style={styles.acceptButtonText}>Aceptar Regalo</Text>
                    </TouchableOpacity>
                )}
            </View>
            <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteButton}>
                <FontAwesome name="trash-o" size={22} color={Colors.theme.grey} />
            </TouchableOpacity>
        </View>
    );
};

// --- Pantalla de Notificaciones ---
export default function NotificationsScreen() {
    const { user, promptLogin } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAndReadNotifications = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const notificationsRef = collection(db, "notifications");
            const q = query(notificationsRef, where("userId", "==", user.uid), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const fetchedNotifications: Notification[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
            setNotifications(fetchedNotifications);

            const unreadNotifications = fetchedNotifications.filter(n => !n.isRead).map(n => n.id);
            if (unreadNotifications.length > 0) {
                const batch = writeBatch(db);
                unreadNotifications.forEach(notifId => {
                    batch.update(doc(db, "notifications", notifId), { isRead: true });
                });
                await batch.commit();
            }
        } catch (e) {
            console.error("Failed to load notifications.", e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            if (user) {
                fetchAndReadNotifications();
            } else {
                setNotifications([]);
                setLoading(false);
            }
        }, [user])
    );
    
    const handleDeleteOne = async (id: string) => {
        try {
            await deleteDoc(doc(db, "notifications", id));
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (e) {
            console.error("Error al eliminar la notificación:", e);
        }
    };

    const handleAcceptGift = async (notification: Notification) => {
        if (!user || !notification.prize) return;
        try {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                frames: arrayUnion(notification.prize)
            });
            await deleteDoc(doc(db, "notifications", notification.id));
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
            Alert.alert("¡Regalo Aceptado!", `Has añadido "${notification.prize.name}" a tu colección de marcos.`);
        } catch (error) {
            console.error("Error al aceptar el regalo: ", error);
            Alert.alert("Error", "No se pudo aceptar el regalo.");
        }
    };

    const handleClearAll = async () => {
        if (!user || notifications.length === 0) return;
        
        Alert.alert(
            "Borrar Todas",
            "¿Estás seguro de que quieres borrar todas tus notificaciones?",
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Borrar", style: "destructive", onPress: async () => {
                    try {
                        const batch = writeBatch(db);
                        notifications.forEach(notification => {
                            batch.delete(doc(db, "notifications", notification.id));
                        });
                        await batch.commit();
                        setNotifications([]);
                    } catch (e) {
                        console.error("Error al eliminar todas las notificaciones:", e);
                    }
                }}
            ]
        );
    };

    const GuestView = () => (
        <View style={styles.guestContainer}>
            <FontAwesome name="bell-slash-o" size={50} color={Colors.theme.grey} />
            <Text style={styles.guestTitle}>Tus Notificaciones</Text>
            <Text style={styles.guestSubtitle}>Inicia sesión para ver tus notificaciones sobre seguidores, comentarios y más.</Text>
            <TouchableOpacity style={styles.guestButton} onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.guestButtonText}>Iniciar Sesión o Registrarse</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            {!user ? (
                <GuestView />
            ) : loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={Colors.theme.primary} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={({ item }) => <NotificationCard item={item} onDelete={handleDeleteOne} onAcceptGift={handleAcceptGift} />}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        <View style={styles.headerContainer}>
                            <Text style={styles.headerTitle}>Notificaciones</Text>
                            {notifications.length > 0 && (
                                <TouchableOpacity onPress={handleClearAll}>
                                    <Text style={styles.clearButton}>Borrar todas</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <FontAwesome name="bell-o" size={40} color={Colors.theme.grey} />
                            <Text style={styles.emptyText}>No tienes notificaciones nuevas.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: 15, paddingBottom: 80 },
    headerContainer: { 
        paddingTop: 60, 
        paddingBottom: 20,
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
    },
    headerTitle: { 
        fontSize: 32, 
        fontWeight: 'bold', 
        color: Colors.theme.text, 
    },
    clearButton: { 
        fontSize: 14, 
        color: Colors.theme.primary, 
        fontWeight: '600', 
    },
    card: { 
        backgroundColor: Colors.theme.card, 
        borderRadius: 15, 
        padding: 15, 
        marginBottom: 12, 
        flexDirection: 'row', 
        alignItems: 'center', 
        shadowColor: "#000", 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.05, 
        shadowRadius: 5, 
        elevation: 2, 
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    cardUnread: { 
        backgroundColor: '#fff8f2',
        borderColor: Colors.theme.primary,
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    cardTextContainer: { flex: 1 },
    cardMessage: { 
        fontSize: 15, 
        fontWeight: '600', 
        color: Colors.theme.text, 
        marginBottom: 4, 
    },
    cardReason: { 
        fontSize: 13, 
        color: Colors.theme.grey, 
        fontStyle: 'italic', 
        marginBottom: 6, 
    },
    cardDate: { 
        fontSize: 12, 
        color: Colors.theme.grey, 
    },
    acceptButton: { 
        backgroundColor: Colors.theme.secondary, 
        paddingVertical: 8, 
        borderRadius: 8, 
        marginTop: 10, 
        alignItems: 'center' 
    },
    acceptButtonText: { 
        color: 'white', 
        fontWeight: 'bold' 
    },
    deleteButton: {
        padding: 8,
        marginLeft: 10,
    },
    emptyContainer: { 
        flex: 1, 
        marginTop: '40%', 
        alignItems: 'center', 
        justifyContent: 'center', 
    },
    emptyText: { 
        fontSize: 18, 
        color: Colors.theme.grey, 
        fontWeight: '600', 
        marginTop: 15, 
    },
    guestContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    guestTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.theme.text,
        textAlign: 'center',
        marginTop: 20,
    },
    guestSubtitle: {
        fontSize: 16,
        color: Colors.theme.grey,
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 30,
    },
    guestButton: {
        backgroundColor: Colors.theme.secondary,
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: 30,
    },
    guestButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
