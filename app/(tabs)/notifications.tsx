import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
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

// --- Componente de la Tarjeta de Notificación ---
const NotificationCard = ({ item, onDelete, onAcceptGift }: { item: Notification; onDelete: (id: string) => void; onAcceptGift: (notification: Notification) => void; }) => {
    let iconName: React.ComponentProps<typeof FontAwesome>['name'];
    let iconColor: string;

    switch (item.status) {
        case 'approved':
            iconName = "check-circle";
            iconColor = Colors.theme.accent;
            break;
        case 'rejected':
            iconName = "times-circle";
            iconColor = Colors.theme.primary;
            break;
        case 'follow':
            iconName = "user-plus";
            iconColor = Colors.theme.primary;
            break;
        case 'gift':
            iconName = "gift";
            iconColor = Colors.theme.secondary;
            break;
        default:
            iconName = "bell";
            iconColor = Colors.theme.grey;
    }

    const date = item.createdAt ? item.createdAt.toDate().toLocaleDateString('es-CL') : 'Fecha no disponible';

    return (
        <View style={[styles.card, !item.isRead && styles.cardUnread]}>
            <FontAwesome name={iconName} size={30} color={iconColor} style={styles.cardIcon} />
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
            <TouchableOpacity onPress={() => onDelete(item.id)}>
                <FontAwesome name="trash" size={24} color={Colors.theme.grey} />
            </TouchableOpacity>
        </View>
    );
};
// --- Pantalla de Notificaciones ---
export default function NotificationsScreen() {
    const { user } = useAuth();
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
        if (!user) return;
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
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            {!user ? (
                <View style={styles.authContainer}>
                    <FontAwesome name="user-circle-o" size={60} color={Colors.theme.grey} />
                    <Text style={styles.authText}>Debes iniciar sesión para ver tus notificaciones.</Text>
                </View>
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
                                <Text style={styles.clearButton} onPress={handleClearAll}>
                                    Borrar todas
                                </Text>
                            )}
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <FontAwesome name="bell-o" size={40} color={Colors.theme.grey} />
                            <Text style={styles.emptyText}>No tienes notificaciones.</Text>
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
    listContent: { paddingHorizontal: 20, paddingBottom: 80 },
    headerTitle: { fontSize: 32, fontWeight: 'bold', color: Colors.theme.text, },
    card: { backgroundColor: Colors.theme.card, borderRadius: 15, padding: 15, marginBottom: 15, flexDirection: 'row', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, borderLeftWidth: 5, borderColor: 'transparent' },
    cardUnread: { borderColor: Colors.theme.primary, backgroundColor: '#fff7f2' },
    cardIcon: { marginRight: 15, },
    cardTextContainer: { flex: 1 },
    cardMessage: { fontSize: 16, fontWeight: '600', color: Colors.theme.text, marginBottom: 5, },
    cardReason: { fontSize: 14, color: Colors.theme.grey, fontStyle: 'italic', marginBottom: 8, },
    cardDate: { fontSize: 12, color: Colors.theme.grey, },
    acceptButton: { backgroundColor: Colors.theme.accent, paddingVertical: 8, borderRadius: 8, marginTop: 10, alignItems: 'center' },
    acceptButtonText: { color: 'white', fontWeight: 'bold' },
    emptyContainer: { flex: 1, marginTop: '50%', alignItems: 'center', justifyContent: 'center', },
    emptyText: { fontSize: 18, color: Colors.theme.grey, fontWeight: '600', marginTop: 15, },
    authContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, },
    authText: { fontSize: 18, color: Colors.theme.grey, textAlign: 'center', marginTop: 20, fontWeight: '600', },
    headerContainer: { marginTop: 60, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 5, },
    clearButton: { fontSize: 14, color: Colors.theme.primary, fontWeight: '600', },
});
