import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { UserProfile } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import ProfilePicture from './ProfilePicture';

interface LikesModalProps {
    visible: boolean;
    onClose: () => void;
    likerIds: string[];
}

const UserRow = ({ item, onClose }: { item: UserProfile, onClose: () => void }) => {
    const router = useRouter();

    const handlePress = () => {
        onClose(); // Cierra el modal primero
        // Espera un poco para que el modal se cierre antes de navegar
        setTimeout(() => {
            router.push(`/profile/${item.uid}`);
        }, 100);
    };

    return (
        <TouchableOpacity style={styles.userRow} onPress={handlePress}>
            <ProfilePicture photoURL={item.photoURL} frameURL={item.equippedFrameUrl} size={50} />
            <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.name} {item.lastName}</Text>
                <Text style={styles.userNickname}>@{item.nickname}</Text>
            </View>
        </TouchableOpacity>
    );
};

export const LikesModal = ({ visible, onClose, likerIds }: LikesModalProps) => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            if (!likerIds || likerIds.length === 0) {
                setUsers([]);
                return;
            }
            setLoading(true);
            try {
                const chunks = [];
                for (let i = 0; i < likerIds.length; i += 30) {
                    chunks.push(likerIds.slice(i, i + 30));
                }

                const userPromises = chunks.map(chunk => {
                    const usersRef = collection(db, "users");
                    const q = query(usersRef, where(documentId(), "in", chunk));
                    return getDocs(q);
                });

                const userSnapshots = await Promise.all(userPromises);
                const fetchedUsers: UserProfile[] = [];
                userSnapshots.forEach(snapshot => {
                    snapshot.forEach(doc => {
                        fetchedUsers.push({ uid: doc.id, ...doc.data() } as UserProfile);
                    });
                });

                setUsers(fetchedUsers);
            } catch (error) {
                console.error("Error fetching likers:", error);
            } finally {
                setLoading(false);
            }
        };

        if (visible) {
            fetchUsers();
        }
    }, [visible, likerIds]);

    return (
        <Modal animationType="slide" transparent={false} visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Me gusta</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <FontAwesome name="close" size={24} color={Colors.theme.text} />
                    </TouchableOpacity>
                </View>
                {loading ? (
                    <ActivityIndicator style={{ marginTop: 20 }} size="large" color={Colors.theme.primary} />
                ) : (
                    <FlatList
                        data={users}
                        keyExtractor={(item) => item.uid}
                        renderItem={({ item }) => <UserRow item={item} onClose={onClose} />}
                        ListEmptyComponent={<Text style={styles.emptyText}>Nadie ha dado Me gusta aún.</Text>}
                    />
                )}
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 5,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    userInfo: {
        flex: 1,
        marginLeft: 15,
    },
    userName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    userNickname: {
        color: Colors.theme.grey,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        color: Colors.theme.grey,
        fontSize: 16,
    },
});
