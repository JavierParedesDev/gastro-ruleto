import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDocs, increment, limit, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth, UserProfile } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import ProfilePicture from './ProfilePicture';

// --- Sub-componente para mostrar cada usuario ---
const UserRow = ({ item, currentUser, onFollowToggle }: { item: UserProfile, currentUser: UserProfile, onFollowToggle: (targetUser: UserProfile, isFollowing: boolean) => void }) => {
    const router = useRouter();
    const [isFollowing, setIsFollowing] = useState(false);

    useEffect(() => {
        // Escucha en tiempo real si el usuario actual sigue al usuario de la lista.
        const followingDocRef = doc(db, "users", currentUser.uid, "following", item.uid);
        const unsubscribe = onSnapshot(followingDocRef, (doc) => {
            setIsFollowing(doc.exists());
        });
        return () => unsubscribe();
    }, [currentUser.uid, item.uid]);

    const handlePress = () => {
        router.push(`/profile/${item.uid}`);
    };

    return (
        <TouchableOpacity style={styles.userRow} onPress={handlePress}>
            <ProfilePicture photoURL={item.photoURL} frameURL={item.equippedFrameUrl} size={50} />
            <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.name} {item.lastName}</Text>
                <Text style={styles.userNickname}>@{item.nickname}</Text>
            </View>
            {item.uid !== currentUser.uid && (
                <TouchableOpacity 
                    style={[styles.followButton, isFollowing && styles.followingButton]} 
                    onPress={() => onFollowToggle(item, isFollowing)}
                >
                    <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                        {isFollowing ? 'Dejar de seguir' : 'Seguir'}
                    </Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
};


// --- Componente principal del Modal ---
export const FriendsModal = ({ visible, onClose, initialTab = 'search' }: { visible: boolean, onClose: () => void, initialTab?: 'following' | 'followers' | 'search' }) => {
    const { user: loggedInUser, promptLogin } = useAuth();
    const [activeTab, setActiveTab] = useState(initialTab);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [following, setFollowing] = useState<UserProfile[]>([]);
    const [followers, setFollowers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    const fetchData = useCallback(async (tab: 'following' | 'followers') => {
        if (!loggedInUser) return;
        setLoading(true);
        try {
            const listRef = collection(db, "users", loggedInUser.uid, tab);
            const snapshot = await getDocs(listRef);
            const userIds = snapshot.docs.map(d => d.id);
            if (userIds.length > 0) {
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("uid", "in", userIds));
                const usersSnapshot = await getDocs(q);
                const usersData = usersSnapshot.docs.map(d => d.data() as UserProfile);
                if (tab === 'following') setFollowing(usersData);
                else setFollowers(usersData);
            } else {
                if (tab === 'following') setFollowing([]);
                else setFollowers([]);
            }
        } catch (e) {
            console.error("Error fetching data: ", e);
        } finally {
            setLoading(false);
        }
    }, [loggedInUser]);

    useEffect(() => {
        if (visible && (activeTab === 'following' || activeTab === 'followers')) {
            fetchData(activeTab);
        }
        if (visible && activeTab === 'search') {
            setSearchResults([]);
            setSearchQuery('');
        }
    }, [visible, activeTab, fetchData]);

    const handleSearch = async () => {
        if (searchQuery.trim().length < 3) {
            setSearchResults([]);
            return;
        }
        setLoading(true);
        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("nickname", ">=", searchQuery.toLowerCase()), where("nickname", "<=", searchQuery.toLowerCase() + '\uf8ff'), limit(10));
            const snapshot = await getDocs(q);
            setSearchResults(snapshot.docs.map(d => d.data() as UserProfile));
        } catch (e) {
            console.error("Error searching users: ", e);
        } finally {
            setLoading(false);
        }
    };

    const handleFollowToggle = async (profileUser: UserProfile, wasFollowing: boolean) => {
        if (!loggedInUser) {
            promptLogin();
            return;
        }
        if (!profileUser) return;

        const currentUserRef = doc(db, "users", loggedInUser.uid);
        const profileUserRef = doc(db, "users", profileUser.uid);

        try {
            await runTransaction(db, async (transaction) => {
                const followingRef = doc(currentUserRef, "following", profileUser.uid);
                const followerRef = doc(profileUserRef, "followers", loggedInUser.uid);

                if (wasFollowing) {
                    transaction.delete(followerRef);
                    transaction.delete(followingRef);
                    transaction.update(profileUserRef, { followersCount: increment(-1) });
                    transaction.update(currentUserRef, { followingCount: increment(-1) });
                } else {
                    // **CORRECCIÓN**: Se añaden valores por defecto para evitar errores con 'undefined'.
                    const followerData = { 
                        uid: loggedInUser.uid, 
                        nickname: loggedInUser.nickname || '', 
                        photoURL: loggedInUser.photoURL || '', 
                        followedAt: serverTimestamp() 
                    };
                    const followingData = { 
                        uid: profileUser.uid, 
                        nickname: profileUser.nickname || '', 
                        photoURL: profileUser.photoURL || '', 
                        followedAt: serverTimestamp() 
                    };

                    transaction.set(followerRef, followerData);
                    transaction.set(followingRef, followingData);
                    transaction.update(profileUserRef, { followersCount: increment(1) });
                    transaction.update(currentUserRef, { followingCount: increment(1) });
                }
            });

            if (!wasFollowing) {
                const notificationsRef = collection(db, 'notifications');
                await addDoc(notificationsRef, {
                    userId: profileUser.uid,
                    message: `${loggedInUser.name} ${loggedInUser.lastName} ha comenzado a seguirte.`,
                    status: 'follow',
                    isRead: false,
                    createdAt: serverTimestamp(),
                });
            }
        } catch (error) {
            console.error("Error al seguir/dejar de seguir:", error);
            Alert.alert("Error", "No se pudo completar la acción.");
        }
    };

    const renderContent = () => {
        if (loading) return <ActivityIndicator style={{ marginTop: 20 }} color={Colors.theme.primary} />;
        
        let data: UserProfile[] = [];
        if (activeTab === 'search') data = searchResults;
        else if (activeTab === 'following') data = following;
        else if (activeTab === 'followers') data = followers;

        return (
            <FlatList
                data={data}
                keyExtractor={(item) => item.uid}
                renderItem={({ item }) => <UserRow item={item} currentUser={loggedInUser!} onFollowToggle={handleFollowToggle} />}
                ListEmptyComponent={<Text style={styles.emptyText}>No se encontraron usuarios.</Text>}
            />
        );
    };

    return (
        <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Conectar</Text>
                    <TouchableOpacity onPress={onClose}><FontAwesome name="close" size={24} /></TouchableOpacity>
                </View>
                <View style={styles.tabBar}>
                    <TouchableOpacity onPress={() => setActiveTab('following')} style={[styles.tab, activeTab === 'following' && styles.activeTab]}><Text style={styles.tabText}>Siguiendo</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveTab('followers')} style={[styles.tab, activeTab === 'followers' && styles.activeTab]}><Text style={styles.tabText}>Seguidores</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setActiveTab('search')} style={[styles.tab, activeTab === 'search' && styles.activeTab]}><Text style={styles.tabText}>Buscar</Text></TouchableOpacity>
                </View>

                {activeTab === 'search' && (
                    <View style={styles.searchContainer}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar por nickname..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearch}
                        />
                        <TouchableOpacity onPress={handleSearch}><FontAwesome name="search" size={20} color={Colors.theme.primary} /></TouchableOpacity>
                    </View>
                )}
                {renderContent()}
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    tabBar: { flexDirection: 'row', justifyContent: 'space-around', borderBottomWidth: 1, borderColor: '#eee' },
    tab: { paddingVertical: 15, borderBottomWidth: 3, borderColor: 'transparent' },
    activeTab: { borderColor: Colors.theme.primary },
    tabText: { fontSize: 16, fontWeight: '600' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
    searchInput: { flex: 1, height: 40, backgroundColor: '#f0f0f0', borderRadius: 10, paddingHorizontal: 15, marginRight: 10 },
    userRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#f0f0f0' },
    userInfo: { flex: 1, marginLeft: 15 },
    userName: { fontSize: 16, fontWeight: 'bold' },
    userNickname: { color: Colors.theme.grey },
    followButton: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, backgroundColor: Colors.theme.primary },
    followingButton: { backgroundColor: Colors.theme.card, borderWidth: 1, borderColor: Colors.theme.grey },
    followButtonText: { color: 'white', fontWeight: 'bold' },
    followingButtonText: { color: Colors.theme.grey },
    emptyText: { textAlign: 'center', marginTop: 50, color: Colors.theme.grey },
});
