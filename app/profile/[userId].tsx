import { FontAwesome } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, increment, onSnapshot, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PostDetailModal } from '../../components/PostDetailModal';
import ProfilePicture from '../../components/ProfilePicture';
import { Colors } from '../../constants/Colors';
import { useAuth, UserProfile } from '../../context/AuthContext';
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

// --- Componentes ---
const ProfilePostCard = ({ item, onPress }: { item: Post, onPress: () => void }) => (
    <TouchableOpacity style={styles.postItem} onPress={onPress}>
        <Image source={{ uri: item.image }} style={styles.postImage} />
    </TouchableOpacity>
);

// --- Pantalla de Perfil Público ---
export default function UserProfileScreen() {
    const router = useRouter();
    const { userId } = useLocalSearchParams();
    const { user: loggedInUser, promptLogin } = useAuth();

    const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [activeTab, setActiveTab] = useState<'posts' | 'badges' | 'frames'>('posts');

    const isMyProfile = loggedInUser?.uid === userId;

    useEffect(() => {
        if (!userId || typeof userId !== 'string') return;

        setLoading(true);
        const userDocRef = doc(db, "users", userId);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setProfileUser({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
            } else {
                setProfileUser(null);
            }
            setLoading(false);
        });

        const postsRef = collection(db, "posts");
        const q = query(postsRef, where("authorId", "==", userId), orderBy("createdAt", "desc"));
        const unsubscribePosts = onSnapshot(q, (querySnapshot) => {
            setUserPosts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[]);
        });

        return () => {
            unsubscribeUser();
            unsubscribePosts();
        };
    }, [userId]);

    useEffect(() => {
        if (!loggedInUser || !userId || isMyProfile) {
            setIsFollowing(false);
            return;
        }
        const followRef = doc(db, "users", loggedInUser.uid, "following", userId as string);
        const unsubscribeFollow = onSnapshot(followRef, (docSnap) => {
            setIsFollowing(docSnap.exists());
        });

        return () => unsubscribeFollow();
    }, [loggedInUser, userId, isMyProfile]);

    const handleFollow = async () => {
        if (!loggedInUser) {
            promptLogin();
            return;
        }
        if (isMyProfile || !profileUser) return;

        const wasFollowing = isFollowing;
        const originalFollowerCount = profileUser.followersCount || 0;

        setIsFollowing(!wasFollowing);
        setProfileUser(prev => prev ? {
            ...prev,
            followersCount: wasFollowing ? originalFollowerCount - 1 : originalFollowerCount + 1
        } : null);

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
                    transaction.set(followerRef, { followedAt: serverTimestamp() });
                    transaction.set(followingRef, { followedAt: serverTimestamp() });
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
            
            setIsFollowing(wasFollowing);
            setProfileUser(prev => prev ? { ...prev, followersCount: originalFollowerCount } : null);
        }
    };

    if (loading) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.theme.primary} /></View>;
    }

    if (!profileUser) {
        return <View style={styles.loadingContainer}><Text>No se encontró el perfil.</Text></View>;
    }
    
    const userTitle = profileUser.badges && profileUser.badges.length > 0 ? profileUser.badges[profileUser.badges.length - 1] : null;

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <FontAwesome name="arrow-left" size={20} color={Colors.theme.text} />
            </TouchableOpacity>
            <FlatList
                ListHeaderComponent={
                    <>
                        <View style={styles.headerContainer}>
                            <ProfilePicture 
                                photoURL={profileUser.photoURL}
                                frameURL={profileUser.equippedFrameUrl}
                                size={screenWidth * 0.3}
                                borderColor={Colors.theme.primary}
                                borderWidth={4}
                            />
                            <Text style={styles.name}>{profileUser.name} {profileUser.lastName}</Text>
                            <Text style={styles.nickname}>@{profileUser.nickname}</Text>
                            {userTitle && (
                                <View style={styles.titleBadge}>
                                    <FontAwesome name="trophy" size={14} color="#D4AF37" />
                                    <Text style={styles.userTitle}>{userTitle}</Text>
                                </View>
                            )}
                            {profileUser.description && <Text style={styles.description}>{profileUser.description}</Text>}
                            <View style={styles.statsContainer}>
                                <View style={styles.stat}><Text style={styles.statNumber}>{userPosts.length}</Text><Text style={styles.statLabel}>Posts</Text></View>
                                <View style={styles.statSeparator} />
                                <View style={styles.stat}><Text style={styles.statNumber}>{profileUser.followersCount || 0}</Text><Text style={styles.statLabel}>Seguidores</Text></View>
                                <View style={styles.statSeparator} />
                                <View style={styles.stat}><Text style={styles.statNumber}>{profileUser.followingCount || 0}</Text><Text style={styles.statLabel}>Siguiendo</Text></View>
                            </View>
                            {!isMyProfile && (
                                <TouchableOpacity style={[styles.profileButton, isFollowing ? styles.followingButton : styles.followButton]} onPress={handleFollow}>
                                    <Text style={isFollowing ? styles.followingButtonText : styles.followButtonText}>
                                        {isFollowing ? 'Siguiendo' : 'Seguir'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <View style={styles.tabContainer}>
                            <TouchableOpacity onPress={() => setActiveTab('posts')} style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}><FontAwesome name="th" size={20} color={activeTab === 'posts' ? Colors.theme.primary : Colors.theme.grey} /></TouchableOpacity>
                            <TouchableOpacity onPress={() => setActiveTab('badges')} style={[styles.tabButton, activeTab === 'badges' && styles.tabButtonActive]}><FontAwesome name="trophy" size={20} color={activeTab === 'badges' ? Colors.theme.primary : Colors.theme.grey} /></TouchableOpacity>
                        </View>
                    </>
                }
                data={activeTab === 'posts' ? userPosts : []}
                numColumns={3}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <ProfilePostCard item={item} onPress={() => setSelectedPost(item)} />}
                ListFooterComponent={
                    <View>
                        {activeTab === 'badges' && (
                            <View style={styles.itemsSection}>
                                {(profileUser.badges && profileUser.badges.length > 0) ? profileUser.badges.map((badge, index) => (
                                    <View key={index} style={styles.badgeItem}><Text style={styles.badgeEmoji}>🏆</Text><Text style={styles.badgeText}>{badge}</Text></View>
                                )) : <View style={styles.emptyContainer}><Text style={styles.emptyText}>Este usuario no tiene insignias.</Text></View>}
                            </View>
                        )}
                    </View>
                }
                ListEmptyComponent={ activeTab === 'posts' && userPosts.length === 0 ? <View style={styles.emptyContainer}><Text style={styles.emptyText}>Este sazonador aún no ha publicado nada.</Text></View> : null}
            />
            <PostDetailModal visible={!!selectedPost} onClose={() => setSelectedPost(null)} post={selectedPost} onPostUpdate={() => {}} />
        </SafeAreaView>
    );
}

const screenWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backButton: { position: 'absolute', top: 50, left: 20, zIndex: 10, backgroundColor: Colors.theme.card, padding: 10, borderRadius: 20, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
    headerContainer: { alignItems: 'center', paddingTop: 80, paddingBottom: 20, backgroundColor: Colors.theme.card, paddingHorizontal: 20 },
    name: { fontSize: 22, fontWeight: 'bold', color: Colors.theme.text, marginTop: 15 },
    nickname: { fontSize: 16, color: Colors.theme.grey, marginTop: 2 },
    titleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        borderRadius: 15,
        paddingHorizontal: 12,
        paddingVertical: 5,
        marginTop: 8,
    },
    userTitle: {
        marginLeft: 6,
        fontSize: 14,
        fontWeight: '600',
        color: Colors.theme.text,
    },
    description: {
        fontSize: 15,
        color: Colors.theme.grey,
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 10,
        paddingHorizontal: 10,
    },
    statsContainer: { flexDirection: 'row', marginVertical: 20 },
    stat: { alignItems: 'center', paddingHorizontal: 20 },
    statNumber: { fontSize: 18, fontWeight: 'bold', color: Colors.theme.text },
    statLabel: { fontSize: 14, color: Colors.theme.grey, marginTop: 4 },
    statSeparator: { width: 1, backgroundColor: '#e0e0e0' },
    profileButton: { paddingVertical: 10, paddingHorizontal: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    followButton: { backgroundColor: Colors.theme.primary },
    followButtonText: { color: Colors.theme.textLight, fontWeight: 'bold', fontSize: 14 },
    followingButton: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.theme.primary },
    followingButtonText: { color: Colors.theme.primary, fontWeight: 'bold', fontSize: 14 },
    tabContainer: { flexDirection: 'row', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', backgroundColor: Colors.theme.card },
    tabButton: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabButtonActive: { borderBottomColor: Colors.theme.primary },
    postItem: { width: (screenWidth / 3) - 2, height: (screenWidth / 3) - 2, margin: 1 },
    postImage: { width: '100%', height: '100%' },
    emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    emptyText: { fontSize: 16, color: Colors.theme.grey, textAlign: 'center' },
    itemsSection: { padding: 20 },
    badgeItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.theme.card, padding: 15, borderRadius: 10, marginBottom: 10, elevation: 2 },
    badgeEmoji: { fontSize: 30, marginRight: 15 },
    badgeText: { fontSize: 16, fontWeight: '600', color: Colors.theme.text },
});
