import { FontAwesome } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, increment, onSnapshot, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, SafeAreaView, StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, View } from 'react-native';
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

// --- Componente para el patrón de fondo ---
const HeaderIconPattern = () => {
    const pattern = useMemo(() => {
        const icons = ['cutlery', 'spoon', 'coffee', 'glass', 'lemon-o', 'star-o', 'heart-o'];
        const generatedPattern = [];
        const numIcons = 40;

        for (let i = 0; i < numIcons; i++) {
            const iconName = icons[i % icons.length] as React.ComponentProps<typeof FontAwesome>['name'];
            const style: StyleProp<TextStyle> = {
                position: 'absolute',
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                transform: [
                    { rotate: `${Math.random() * 360}deg` },
                    { scale: Math.random() * 0.6 + 0.4 }
                ],
                opacity: 0.1,
            };
            generatedPattern.push(
                <FontAwesome key={i} name={iconName} size={30} color={Colors.theme.textLight} style={style} />
            );
        }
        return generatedPattern;
    }, []);

    return <View style={StyleSheet.absoluteFill}>{pattern}</View>;
};

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
    const [activeTab, setActiveTab] = useState<'posts' | 'badges'>('posts');

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
            <FlatList
                ListHeaderComponent={
                    <>
                        <View style={styles.headerShape}>
                            <HeaderIconPattern />
                            <View style={styles.headerContent}>
                                <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
                                    <FontAwesome name="arrow-left" size={24} color={Colors.theme.textLight} />
                                </TouchableOpacity>
                                <ProfilePicture 
                                    photoURL={profileUser.photoURL}
                                    frameURL={profileUser.equippedFrameUrl}
                                    size={screenWidth * 0.3}
                                    borderColor={Colors.theme.background}
                                    borderWidth={4}
                                />
                                <View style={{ width: 44 }} />
                            </View>
                            <Text style={styles.name}>{profileUser.name} {profileUser.lastName}</Text>
                            <Text style={styles.nickname}>@{profileUser.nickname}</Text>
                            {profileUser.description && <Text style={styles.description}>{profileUser.description}</Text>}
                        </View>

                        <View style={styles.statsContainer}>
                            <View style={styles.stat}><Text style={styles.statNumber}>{userPosts.length}</Text><Text style={styles.statLabel}>Posts</Text></View>
                            <View style={styles.stat}><Text style={styles.statNumber}>{profileUser.followersCount || 0}</Text><Text style={styles.statLabel}>Seguidores</Text></View>
                            <View style={styles.stat}><Text style={styles.statNumber}>{profileUser.followingCount || 0}</Text><Text style={styles.statLabel}>Siguiendo</Text></View>
                        </View>
                        
                        {!isMyProfile && (
                            <TouchableOpacity style={[styles.actionButton, isFollowing ? styles.followingButton : styles.followButton]} onPress={handleFollow}>
                                <Text style={isFollowing ? styles.followingButtonText : styles.followButtonText}>
                                    {isFollowing ? 'Siguiendo' : 'Seguir'}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <View style={styles.tabContainer}>
                            <TouchableOpacity onPress={() => setActiveTab('posts')} style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}>
                                <FontAwesome name="th" size={20} color={activeTab === 'posts' ? Colors.theme.secondary : Colors.theme.grey} />
                                <Text style={[styles.tabText, activeTab === 'posts' && {color: Colors.theme.secondary}]}>Posts</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setActiveTab('badges')} style={[styles.tabButton, activeTab === 'badges' && styles.tabButtonActive]}>
                                <FontAwesome name="trophy" size={20} color={activeTab === 'badges' ? Colors.theme.secondary : Colors.theme.grey} />
                                <Text style={[styles.tabText, activeTab === 'badges' && {color: Colors.theme.secondary}]}>Insignias</Text>
                            </TouchableOpacity>
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
    headerShape: {
        backgroundColor: Colors.theme.primary,
        paddingBottom: 60,
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        alignItems: 'center',
        overflow: 'hidden',
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 30,
        paddingTop: 50,
        zIndex: 1,
    },
    headerButton: {
        padding: 10,
    },
    name: { fontSize: 24, fontWeight: 'bold', color: Colors.theme.textLight, marginTop: 15, zIndex: 1 },
    nickname: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 2, zIndex: 1 },
    description: { fontSize: 14, color: Colors.theme.textLight, textAlign: 'center', marginTop: 10, paddingHorizontal: 40, fontStyle: 'italic', zIndex: 1 },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '90%',
        alignSelf: 'center',
        backgroundColor: Colors.theme.card,
        borderRadius: 20,
        paddingVertical: 20,
        marginTop: -40,
        elevation: 10,
        shadowColor: Colors.theme.shadow,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    stat: { alignItems: 'center' },
    statNumber: { fontSize: 20, fontWeight: 'bold', color: Colors.theme.text },
    statLabel: { fontSize: 14, color: Colors.theme.grey, marginTop: 4 },
    actionButton: {
        alignSelf: 'center',
        marginTop: 20,
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 30,
        elevation: 5,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    followButton: {
        backgroundColor: Colors.theme.secondary,
        shadowColor: Colors.theme.secondary,
    },
    followingButton: {
        backgroundColor: Colors.theme.card,
        borderWidth: 2,
        borderColor: Colors.theme.secondary,
    },
    followButtonText: {
        color: Colors.theme.textLight,
        fontWeight: 'bold',
        fontSize: 16,
    },
    followingButtonText: {
        color: Colors.theme.secondary,
        fontWeight: 'bold',
        fontSize: 16,
    },
    tabContainer: { 
        flexDirection: 'row', 
        justifyContent: 'space-around', 
        borderBottomWidth: 1, 
        borderBottomColor: '#e0e0e0', 
        backgroundColor: Colors.theme.card,
        marginTop: 25,
        marginHorizontal: 20,
        borderRadius: 15,
        paddingVertical: 5,
    },
    tabButton: { 
        alignItems: 'center', 
        padding: 10,
        borderRadius: 10,
    },
    tabButtonActive: { 
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
    },
    tabText: {
        fontSize: 12,
        color: Colors.theme.grey,
        marginTop: 4,
    },
    postItem: { width: (screenWidth / 3), height: (screenWidth / 3), position: 'relative' },
    postImage: { width: '100%', height: '100%' },
    emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    emptyText: { fontSize: 16, color: Colors.theme.grey, textAlign: 'center' },
    itemsSection: { padding: 20 },
    badgeItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.theme.card, padding: 15, borderRadius: 10, marginBottom: 10, elevation: 2 },
    badgeEmoji: { fontSize: 30, marginRight: 15 },
    badgeText: { fontSize: 16, fontWeight: '600', color: Colors.theme.text },
});