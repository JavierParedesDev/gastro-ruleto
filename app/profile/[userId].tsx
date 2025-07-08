import { FontAwesome } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, increment, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PostDetailModal } from '../../components/PostDetailModal';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';

// --- Interfaces ---
interface Post {
    id: string;
    title: string;
    image: string;
    likes: string[];
    authorId: string;
    authorName: string;
    authorPhoto: string;
    description?: string;
}

interface UserProfile {
    uid: string;
    name: string;
    lastName: string;
    email: string;
    photoURL?: string;
    followersCount?: number;
    followingCount?: number;
    badges?: string[];
}

// --- Interfaces para Props de Componentes ---
interface ProfileHeaderProps {
    user: UserProfile;
    isMyProfile: boolean;
    isFollowing: boolean;
    latestBadge?: string;
    onFollow: () => void;
    onEdit: () => void;
    onLogout: () => void;
}

// --- Componentes de la Pantalla ---
const ProfileHeader = ({ user, isMyProfile, isFollowing, onFollow, onEdit, onLogout, latestBadge }: ProfileHeaderProps) => (
    <View style={styles.headerContainer}>
        <Image source={{ uri: user.photoURL || 'https://placehold.co/150x150/FFDDC9/FF5C00?text=Foto' }} style={styles.profileImage} />
        <Text style={styles.name}>{user.name} {user.lastName}</Text>
        
        <View style={styles.statsContainer}>
            <View style={styles.stat}>
                <Text style={styles.statNumber}>{user.followersCount || 0}</Text>
                <Text style={styles.statLabel}>Seguidores</Text>
            </View>
            <View style={styles.statSeparator} />
            <View style={styles.stat}>
                <Text style={styles.statNumber}>{user.followingCount || 0}</Text>
                <Text style={styles.statLabel}>Siguiendo</Text>
            </View>
        </View>

        {latestBadge && (
            <View style={styles.latestBadgeContainer}>
                <FontAwesome name="trophy" size={22} color="#FFC107" />
                <View style={styles.latestBadgeTextContainer}>
                    <Text style={styles.latestBadgeTitle}>Último Logro</Text>
                    <Text style={styles.latestBadgeName}>{latestBadge}</Text>
                </View>
            </View>
        )}

        {isMyProfile ? (
            <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.profileButton, styles.editButton]} onPress={onEdit}>
                    <Text style={styles.buttonText}>Editar Perfil</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.profileButton, styles.logoutButton]} onPress={onLogout}>
                    <Text style={styles.buttonText}>Cerrar Sesión</Text>
                </TouchableOpacity>
            </View>
        ) : (
            <TouchableOpacity style={[styles.profileButton, isFollowing ? styles.followingButton : styles.followButton]} onPress={onFollow}>
                <Text style={isFollowing ? styles.followingButtonText : styles.followButtonText}>
                    {isFollowing ? 'Siguiendo' : 'Seguir'}
                </Text>
            </TouchableOpacity>
        )}
    </View>
);

const ProfilePostCard = ({ item, onPress }: { item: Post, onPress: () => void }) => (
    <TouchableOpacity style={styles.postItem} onPress={onPress}>
        <Image source={{ uri: item.image }} style={styles.postImage} />
    </TouchableOpacity>
);

export default function UserProfileScreen() {
    const router = useRouter();
    const { userId } = useLocalSearchParams();
    const { user: loggedInUser, logout, promptLogin } = useAuth();

    const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [activeTab, setActiveTab] = useState<'posts' | 'badges'>('posts');

    const isMyProfile = loggedInUser?.uid === userId;

    const fetchData = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const userDocRef = doc(db, "users", userId as string);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                setProfileUser(docSnap.data() as UserProfile);
            }

            const postsRef = collection(db, "posts");
            const q = query(postsRef, where("authorId", "==", userId), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const postsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
            setUserPosts(postsData);

            if (loggedInUser && !isMyProfile) {
                const followRef = doc(db, "users", userId as string, "followers", loggedInUser.uid);
                const followSnap = await getDoc(followRef);
                setIsFollowing(followSnap.exists());
            }
        } catch (error) {
            console.error("Error fetching profile data:", error);
        } finally {
            setLoading(false);
        }
    }, [userId, loggedInUser]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    const handleFollow = async () => {
        if (!loggedInUser) {
            promptLogin();
            return;
        }
        if (isMyProfile || !profileUser) return;

        const wasFollowing = isFollowing; // Captura el estado antes de la transacción

        const currentUserRef = doc(db, "users", loggedInUser.uid);
        const profileUserRef = doc(db, "users", profileUser.uid);
        const followingRef = doc(currentUserRef, "following", profileUser.uid);
        const followerRef = doc(profileUserRef, "followers", loggedInUser.uid);

        try {
            await runTransaction(db, async (transaction) => {
                const followSnap = await transaction.get(followerRef);

                if (followSnap.exists()) {
                    transaction.delete(followerRef);
                    transaction.delete(followingRef);
                    transaction.update(profileUserRef, { followersCount: increment(-1) });
                    transaction.update(currentUserRef, { followingCount: increment(-1) });
                } else {
                    transaction.set(followerRef, { followedAt: serverTimestamp() });
                    transaction.set(followingRef, { followedAt: serverTimestamp() });
                    transaction.update(profileUserRef, { followersCount: increment(1) });
                    transaction.update(currentUserRef, { followingCount: increment(1) });
                }
            });

            // Si la acción fue seguir (es decir, antes no lo seguía), crea una notificación.
            if (!wasFollowing) {
                const notificationsRef = collection(db, 'notifications');
                await addDoc(notificationsRef, {
                    userId: profileUser.uid, // El usuario que es seguido
                    message: `${loggedInUser.name} ${loggedInUser.lastName} ha comenzado a seguirte.`,
                    status: 'follow', // Un estado específico para notificaciones de seguimiento
                    isRead: false,
                    createdAt: serverTimestamp(),
                });
            }

            fetchData();
        } catch (error) {
            console.error("Error al seguir/dejar de seguir:", error);
            Alert.alert("Error", "No se pudo completar la acción de seguir/dejar de seguir.");
        }
    };

    if (loading) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.theme.primary} /></View>;
    }

    if (!profileUser) {
        return <View style={styles.loadingContainer}><Text>No se encontró el perfil.</Text></View>;
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <FontAwesome name="arrow-left" size={20} color={Colors.theme.text} />
            </TouchableOpacity>

            <FlatList
                ListHeaderComponent={
                    <>
                        <ProfileHeader
                            user={profileUser}
                            isMyProfile={isMyProfile}
                            isFollowing={isFollowing}
                            onFollow={handleFollow}
                            onLogout={logout}
                            onEdit={() => Alert.alert("Próximamente", "La edición de perfil estará disponible pronto.")}
                            latestBadge={profileUser.badges && profileUser.badges.length > 0 ? profileUser.badges[profileUser.badges.length - 1] : undefined}
                        />
                        <View style={styles.tabContainer}>
                            <TouchableOpacity onPress={() => setActiveTab('posts')} style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}>
                                <FontAwesome name="th" size={20} color={activeTab === 'posts' ? Colors.theme.primary : Colors.theme.grey} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setActiveTab('badges')} style={[styles.tabButton, activeTab === 'badges' && styles.tabButtonActive]}>
                                <FontAwesome name="trophy" size={20} color={activeTab === 'badges' ? Colors.theme.primary : Colors.theme.grey} />
                            </TouchableOpacity>
                        </View>
                    </>
                }
                data={activeTab === 'posts' ? userPosts : []}
                numColumns={3}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <ProfilePostCard item={item} onPress={() => setSelectedPost(item)} />}
                ListFooterComponent={
                    activeTab === 'badges' ? (
                        <View style={styles.badgesSection}>
                            {profileUser.badges && profileUser.badges.length > 0 ? (
                                profileUser.badges.map((badge, index) => (
                                    <View key={index} style={styles.badgeItem}>
                                        <Text style={styles.badgeEmoji}>🏆</Text>
                                        <Text style={styles.badgeText}>{badge}</Text>
                                    </View>
                                ))
                            ) : (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>Este usuario aún no tiene insignias.</Text>
                                </View>
                            )}
                        </View>
                    ) : null
                }
                ListEmptyComponent={ activeTab === 'posts' ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Este sazonador aún no ha publicado nada.</Text>
                    </View>
                ) : null}
            />
            <PostDetailModal
                visible={!!selectedPost}
                onClose={() => setSelectedPost(null)}
                post={selectedPost}
                onPostUpdate={fetchData}
            />
        </SafeAreaView>
    );
}

const screenWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.theme.background },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
        backgroundColor: Colors.theme.card,
        padding: 10,
        borderRadius: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 5,
    },
    headerContainer: {
        alignItems: 'center',
        paddingTop: 80, // Space for back button
        paddingBottom: 20,
        backgroundColor: Colors.theme.card,
    },
    profileImage: {
        width: screenWidth * 0.3,
        height: screenWidth * 0.3,
        borderRadius: (screenWidth * 0.3) / 2,
        borderWidth: 4,
        borderColor: Colors.theme.primary,
        marginBottom: 15,
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.theme.text,
        marginBottom: 15,
    },
    statsContainer: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    stat: { alignItems: 'center', paddingHorizontal: 25 },
    statNumber: { fontSize: 18, fontWeight: 'bold', color: Colors.theme.text },
    statLabel: { fontSize: 14, color: Colors.theme.grey, marginTop: 4 },
    statSeparator: { width: 1, backgroundColor: '#e0e0e0' },
    latestBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF8E1',
        borderRadius: 15,
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginHorizontal: 20,
        marginBottom: 25,
        borderWidth: 1,
        borderColor: '#FFECB3',
        width: '90%',
    },
    latestBadgeTextContainer: {
        marginLeft: 15,
        flex: 1,
    },
    latestBadgeTitle: {
        fontSize: 12,
        color: Colors.theme.grey,
        fontWeight: '600',
    },
    latestBadgeName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.theme.text,
    },
    buttonRow: { flexDirection: 'row' },
    profileButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginHorizontal: 5,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 130,
    },
    buttonText: { fontWeight: 'bold', fontSize: 14, color: Colors.theme.text },
    editButton: { backgroundColor: '#e5e5e5' },
    logoutButton: { backgroundColor: '#e5e5e5' },
    followButton: { backgroundColor: Colors.theme.primary },
    followButtonText: { color: Colors.theme.textLight, fontWeight: 'bold', fontSize: 14 },
    followingButton: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.theme.primary },
    followingButtonText: { color: Colors.theme.primary, fontWeight: 'bold', fontSize: 14 },
    tabContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        backgroundColor: Colors.theme.card,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 15,
        alignItems: 'center',
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    tabButtonActive: {
        borderBottomColor: Colors.theme.primary,
    },
    postItem: { width: (screenWidth / 3) - 2, height: (screenWidth / 3) - 2, margin: 1 },
    postImage: { width: '100%', height: '100%' },
    emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    emptyText: { fontSize: 16, color: Colors.theme.grey, textAlign: 'center' },
    badgesSection: {
        padding: 20,
    },
    badgeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.theme.card,
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        elevation: 2,
    },
    badgeEmoji: {
        fontSize: 30,
        marginRight: 15,
    },
    badgeText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.theme.text,
    }
});
