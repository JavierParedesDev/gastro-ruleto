import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { collection, doc, getDoc, getDocs, increment, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
    onFollow: () => void;
    onEdit: () => void;
    onLogout: () => void;
}

// --- Componentes de la Pantalla ---
const ProfileHeader = ({ user, isMyProfile, isFollowing, onFollow, onEdit, onLogout }: ProfileHeaderProps) => (
    <View style={styles.header}>
        <Image source={{ uri: user.photoURL || 'https://placehold.co/150x150/FFDDC9/FF5C00?text=Foto' }} style={styles.profileImage} />
        <Text style={styles.name}>{user.name} {user.lastName}</Text>

        <View style={styles.statsContainer}>
            <View style={styles.stat}><Text style={styles.statNumber}>{user.followersCount || 0}</Text><Text style={styles.statLabel}>Seguidores</Text></View>
            <View style={styles.stat}><Text style={styles.statNumber}>{user.followingCount || 0}</Text><Text style={styles.statLabel}>Siguiendo</Text></View>
        </View>

        {isMyProfile ? (
            <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.editButton} onPress={onEdit}><Text style={styles.buttonText}>Editar Perfil</Text></TouchableOpacity>
                <TouchableOpacity style={styles.logoutButton} onPress={onLogout}><Text style={styles.buttonText}>Cerrar Sesión</Text></TouchableOpacity>
            </View>
        ) : (
            <TouchableOpacity style={[styles.followButton, isFollowing && styles.followingButton]} onPress={onFollow}>
                <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>{isFollowing ? 'Siguiendo' : 'Seguir'}</Text>
            </TouchableOpacity>
        )}

        {user.badges && user.badges.length > 0 && (
            <View style={styles.badgesContainer}>
                <Text style={styles.postsTitle}>Insignias</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {user.badges.map((badge, index) => <Text key={index} style={styles.badge}>{badge}</Text>)}
                </ScrollView>
            </View>
        )}
    </View>
);

const ProfilePostCard = ({ item, onPress }: { item: Post, onPress: () => void }) => (
    <TouchableOpacity style={styles.postItem} onPress={onPress}>
        <Image source={{ uri: item.image }} style={styles.postImage} />
    </TouchableOpacity>
);

export default function UserProfileScreen() {
    const { userId } = useLocalSearchParams();
    const { user: loggedInUser, logout, promptLogin } = useAuth();

    const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);

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
            fetchData(); // Llamada segura
        }, [fetchData])
    );

    const handleFollow = async () => {
        if (!loggedInUser) { promptLogin(); return; }
        if (isMyProfile || !profileUser) return;

        const currentUserRef = doc(db, "users", loggedInUser.uid);
        const profileUserRef = doc(db, "users", profileUser.uid);
        const followingRef = doc(currentUserRef, "following", profileUser.uid);
        const followerRef = doc(profileUserRef, "followers", loggedInUser.uid);

        try {
            await runTransaction(db, async (transaction) => {
                if (isFollowing) {
                    transaction.delete(followingRef);
                    transaction.delete(followerRef);
                    transaction.update(currentUserRef, { followingCount: increment(-1) });
                    transaction.update(profileUserRef, { followersCount: increment(-1) });
                } else {
                    transaction.set(followingRef, { followedAt: serverTimestamp() });
                    transaction.set(followerRef, { followedAt: serverTimestamp() });
                    transaction.update(currentUserRef, { followingCount: increment(1) });
                    transaction.update(profileUserRef, { followersCount: increment(1) });
                }
            });
            setIsFollowing(!isFollowing);
            setProfileUser(prev => prev ? { ...prev, followersCount: (prev.followersCount || 0) + (isFollowing ? -1 : 1) } : null);
        } catch (error) {
            console.error("Error al seguir/dejar de seguir:", error);
        }
    };

    if (loading) {
        return <View style={styles.container}><ActivityIndicator size="large" color={Colors.theme.primary} /></View>;
    }

    if (!profileUser) {
        return <View style={styles.container}><Text>No se encontró el perfil.</Text></View>;
    }

    return (
        <>
            <Stack.Screen options={{ title: `${profileUser.name} ${profileUser.lastName}` }} />
            <FlatList
                ListHeaderComponent={
                    <ProfileHeader
                        user={profileUser}
                        isMyProfile={isMyProfile}
                        isFollowing={isFollowing}
                        onFollow={handleFollow}
                        onLogout={logout}
                        onEdit={() => Alert.alert("Próximamente", "La edición de perfil estará disponible pronto.")}
                    />
                }
                data={userPosts}
                numColumns={3}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <ProfilePostCard item={item} onPress={() => setSelectedPost(item)} />}
                contentContainerStyle={styles.container}
                ListHeaderComponentStyle={{ marginBottom: 10 }}
                ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>Este sazonador aún no ha publicado nada.</Text></View>}
            />
            <PostDetailModal
                visible={!!selectedPost}
                onClose={() => setSelectedPost(null)}
                post={selectedPost}
                onPostUpdate={fetchData}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: { backgroundColor: Colors.theme.background, flexGrow: 1 },
    header: { alignItems: 'center', padding: 20, backgroundColor: Colors.theme.card },
    profileImage: { width: 120, height: 120, borderRadius: 60, marginBottom: 10, borderWidth: 4, borderColor: Colors.theme.primary },
    name: { fontSize: 24, fontWeight: 'bold', color: Colors.theme.text },
    statsContainer: { flexDirection: 'row', marginTop: 15, marginBottom: 20 },
    stat: { alignItems: 'center', marginHorizontal: 20 },
    statNumber: { fontSize: 18, fontWeight: 'bold', color: Colors.theme.text },
    statLabel: { fontSize: 14, color: Colors.theme.grey },
    buttonRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-around' },
    editButton: { flex: 1, backgroundColor: Colors.theme.grey, paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginRight: 5 },
    logoutButton: { flex: 1, backgroundColor: '#ddd', paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginLeft: 5 },
    buttonText: { color: Colors.theme.text, fontWeight: 'bold' },
    followButton: { width: '80%', backgroundColor: Colors.theme.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    followingButton: { backgroundColor: Colors.theme.card, borderWidth: 1, borderColor: Colors.theme.grey },
    followButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    followingButtonText: { color: Colors.theme.grey },
    badgesContainer: { width: '100%', marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#eee' },
    postsTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.theme.text, marginBottom: 10 },
    badge: { backgroundColor: '#e8f5e9', color: Colors.theme.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, marginRight: 10, fontWeight: '600' },
    postItem: { flex: 1 / 3, aspectRatio: 1, padding: 2 },
    postImage: { width: '100%', height: '100%', borderRadius: 5 },
    emptyContainer: { padding: 20, alignItems: 'center', marginTop: 20 },
    emptyText: { fontSize: 16, color: Colors.theme.grey },
});
