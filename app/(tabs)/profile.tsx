import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { deleteObject, getStorage, ref } from 'firebase/storage';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EditProfileModal } from '../../components/EditProfileModal';
import { PostDetailModal } from '../../components/PostDetailModal';
import ProfilePicture from '../../components/ProfilePicture';
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
interface Frame { name: string; url: string; }

// --- Componentes ---
const ProfilePostCard = ({ item, onPress, onDelete }: { item: Post, onPress: () => void, onDelete: () => void }) => (
    <TouchableOpacity style={styles.postItem} onPress={onPress}>
        <Image source={{ uri: item.image }} style={styles.postImage} />
        <TouchableOpacity style={styles.deleteIcon} onPress={onDelete}>
            <FontAwesome name="trash" size={18} color="white" />
        </TouchableOpacity>
    </TouchableOpacity>
);

// --- Pantalla de Perfil ---
export default function ProfileScreen() {
    const { user, logout, fetchUserProfile } = useAuth();
    const router = useRouter();
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [activeTab, setActiveTab] = useState<'posts' | 'badges' | 'frames'>('posts');
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [hasNewBadges, setHasNewBadges] = useState(false);
    const [hasNewFrames, setHasNewFrames] = useState(false);

    const loadProfileData = useCallback(async () => {
        if (!user) { 
            setLoadingPosts(false); 
            return; 
        }
        setLoadingPosts(true);
        try {
            await fetchUserProfile(user.uid);
            const postsRef = collection(db, "posts");
            const q = query(postsRef, where("authorId", "==", user.uid), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            setUserPosts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[]);
        } catch (error) { 
            console.error("Error fetching profile data:", error); 
        } finally { 
            setLoadingPosts(false); 
        }
    }, [user?.uid, fetchUserProfile]);

    useEffect(() => {
        if (user) {
            setHasNewBadges((user.badges?.length || 0) > (user.viewedBadgesCount || 0));
            setHasNewFrames((user.frames?.length || 0) > (user.viewedFramesCount || 0));
        }
    }, [user]);

    useFocusEffect(
        useCallback(() => {
            loadProfileData();
        }, [loadProfileData])
    );

    const handleTabChange = async (tabName: 'posts' | 'badges' | 'frames') => {
        setActiveTab(tabName);
        if (!user) return;

        if (tabName === 'badges' && hasNewBadges) {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, { viewedBadgesCount: user.badges?.length || 0 });
            setHasNewBadges(false);
        }

        if (tabName === 'frames' && hasNewFrames) {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, { viewedFramesCount: user.frames?.length || 0 });
            setHasNewFrames(false);
        }
    };

    const handleEquipFrame = async (frameUrl: string) => {
        if (!user) return;
        const currentEquipped = user.equippedFrameUrl;
        const newEquippedUrl = currentEquipped === frameUrl ? '' : frameUrl;
        try {
            await updateDoc(doc(db, "users", user.uid), { equippedFrameUrl: newEquippedUrl });
            await fetchUserProfile(user.uid);
        } catch (error) { Alert.alert("Error", "No se pudo equipar el marco."); }
    };

    const handleDeletePost = async (postId: string, imageUrl: string) => {
        Alert.alert(
            "Confirmar Eliminación",
            "¿Estás seguro de que quieres eliminar esta publicación?",
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: async () => {
                    try {
                        const commentsRef = collection(db, "posts", postId, "comments");
                        const commentsSnapshot = await getDocs(commentsRef);
                        const batch = writeBatch(db);
                        commentsSnapshot.forEach(doc => {
                            batch.delete(doc.ref);
                        });
                        await batch.commit();
                        await deleteDoc(doc(db, "posts", postId));
                        const storage = getStorage();
                        const imageRef = ref(storage, imageUrl);
                        await deleteObject(imageRef);
                        setUserPosts(prevPosts => prevPosts.filter(p => p.id !== postId));
                        Alert.alert("Éxito", "La publicación ha sido eliminada.");
                    } catch (error) {
                        console.error("Error deleting post: ", error);
                        Alert.alert("Error", "No se pudo eliminar la publicación.");
                    }
                }}
            ]
        );
    };

    if (!user) {
        return <SafeAreaView style={styles.loadingContainer}><Text style={styles.emptyText}>Inicia sesión para ver tu perfil.</Text></SafeAreaView>;
    }

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                ListHeaderComponent={
                    <>
                        <View style={styles.headerContainer}>
                            <ProfilePicture 
                                photoURL={user.photoURL}
                                frameURL={user.equippedFrameUrl}
                                size={screenWidth * 0.3}
                                borderColor={Colors.theme.primary}
                                borderWidth={4}
                            />
                            <Text style={styles.name}>{user.name} {user.lastName}</Text>
                            {user.description ? <Text style={styles.description}>{user.description}</Text> : null}
                            <View style={styles.statsContainer}>
                                <View style={styles.stat}><Text style={styles.statNumber}>{userPosts.length}</Text><Text style={styles.statLabel}>Posts</Text></View>
                                <View style={styles.statSeparator} />
                                <View style={styles.stat}><Text style={styles.statNumber}>{user.followersCount || 0}</Text><Text style={styles.statLabel}>Seguidores</Text></View>
                                <View style={styles.statSeparator} />
                                <View style={styles.stat}><Text style={styles.statNumber}>{user.followingCount || 0}</Text><Text style={styles.statLabel}>Siguiendo</Text></View>
                            </View>
                            <View style={styles.buttonRow}>
                                <TouchableOpacity style={[styles.profileButton, styles.editButton]} onPress={() => setIsEditModalVisible(true)}>
                                    <Text style={styles.buttonText}>Editar Perfil</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.profileButton, styles.logoutButton]} onPress={logout}><FontAwesome name="sign-out" size={16} color={Colors.theme.grey} /></TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.tabContainer}>
                            <TouchableOpacity onPress={() => handleTabChange('posts')} style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}><FontAwesome name="th" size={20} color={activeTab === 'posts' ? Colors.theme.primary : Colors.theme.grey} /></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleTabChange('badges')} style={[styles.tabButton, activeTab === 'badges' && styles.tabButtonActive]}>
                                <View>
                                    <FontAwesome name="trophy" size={20} color={activeTab === 'badges' ? Colors.theme.primary : Colors.theme.grey} />
                                    {hasNewBadges && <View style={styles.newIndicator} />}
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleTabChange('frames')} style={[styles.tabButton, activeTab === 'frames' && styles.tabButtonActive]}>
                                <View>
                                    <FontAwesome name="image" size={20} color={activeTab === 'frames' ? Colors.theme.primary : Colors.theme.grey} />
                                    {hasNewFrames && <View style={styles.newIndicator} />}
                                </View>
                            </TouchableOpacity>
                        </View>
                    </>
                }
                data={activeTab === 'posts' ? userPosts : []}
                numColumns={3}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <ProfilePostCard item={item} onPress={() => setSelectedPost(item)} onDelete={() => handleDeletePost(item.id, item.image)} />}
                ListFooterComponent={
                    <View>
                        {loadingPosts && activeTab === 'posts' && <ActivityIndicator style={{ margin: 20 }} color={Colors.theme.primary} />}
                        {activeTab === 'badges' && (
                            <View style={styles.itemsSection}>
                                {(user.badges && user.badges.length > 0) ? user.badges.map((badge, index) => (
                                    <View key={index} style={styles.badgeItem}><Text style={styles.badgeEmoji}>🏆</Text><Text style={styles.badgeText}>{badge}</Text></View>
                                )) : <View style={styles.emptyContainer}><Text style={styles.emptyText}>Aún no tienes insignias.</Text></View>}
                            </View>
                        )}
                        {activeTab === 'frames' && (
                            <View style={styles.itemsSection}>
                                {(user.frames && user.frames.length > 0) ? user.frames.map((frame, index) => (
                                    <TouchableOpacity key={index} style={styles.frameItem} onPress={() => handleEquipFrame(frame.url)}>
                                        <Image source={{ uri: frame.url }} style={styles.framePreview} />
                                        <Text style={styles.frameName}>{frame.name}</Text>
                                        {user.equippedFrameUrl === frame.url && <View style={styles.equippedIndicator}><FontAwesome name="check-circle" size={24} color={Colors.theme.accent} /></View>}
                                    </TouchableOpacity>
                                )) : <View style={styles.emptyContainer}><Text style={styles.emptyText}>Aún no has ganado marcos.</Text></View>}
                            </View>
                        )}
                    </View>
                }
                ListEmptyComponent={ !loadingPosts && activeTab === 'posts' && userPosts.length === 0 ? <View style={styles.emptyContainer}><Text style={styles.emptyText}>Aún no has publicado nada.</Text></View> : null}
            />
            <TouchableOpacity style={styles.fab} onPress={() => router.push('/createPost')}>
                <FontAwesome name="plus" size={24} color="white" />
            </TouchableOpacity>
            <PostDetailModal visible={!!selectedPost} onClose={() => setSelectedPost(null)} post={selectedPost} onPostUpdate={loadProfileData} />
            <EditProfileModal
                visible={isEditModalVisible}
                onClose={() => setIsEditModalVisible(false)}
                onProfileUpdate={loadProfileData}
            />
        </SafeAreaView>
    );
}

const screenWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerContainer: { alignItems: 'center', paddingTop: 60, paddingBottom: 20, backgroundColor: Colors.theme.card, paddingHorizontal: 20 },
    name: { fontSize: 22, fontWeight: 'bold', color: Colors.theme.text, marginTop: 10 },
    description: { fontSize: 14, color: Colors.theme.grey, textAlign: 'center', marginTop: 5, marginBottom: 15 },
    statsContainer: { flexDirection: 'row', marginBottom: 25 },
    stat: { alignItems: 'center', paddingHorizontal: 20 },
    statNumber: { fontSize: 18, fontWeight: 'bold', color: Colors.theme.text },
    statLabel: { fontSize: 14, color: Colors.theme.grey, marginTop: 4 },
    statSeparator: { width: 1, backgroundColor: '#e0e0e0' },
    buttonRow: { flexDirection: 'row', alignItems: 'center' },
    profileButton: { justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginHorizontal: 5 },
    buttonText: { fontWeight: 'bold', fontSize: 14, color: Colors.theme.text },
    editButton: { backgroundColor: '#e5e5e5', paddingVertical: 10, paddingHorizontal: 30 },
    logoutButton: { backgroundColor: '#e5e5e5', padding: 10, width: 40, height: 40, borderRadius: 20 },
    tabContainer: { flexDirection: 'row', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', backgroundColor: Colors.theme.card },
    tabButton: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabButtonActive: { borderBottomColor: Colors.theme.primary },
    newIndicator: { position: 'absolute', top: -2, right: -8, width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.theme.primary, borderWidth: 1.5, borderColor: Colors.theme.card },
    postItem: { width: (screenWidth / 3) - 2, height: (screenWidth / 3) - 2, margin: 1, position: 'relative' },
    postImage: { width: '100%', height: '100%' },
    deleteIcon: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 15 },
    emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    emptyText: { fontSize: 16, color: Colors.theme.grey, textAlign: 'center' },
    itemsSection: { padding: 20 },
    badgeItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.theme.card, padding: 15, borderRadius: 10, marginBottom: 10, elevation: 2 },
    badgeEmoji: { fontSize: 30, marginRight: 15 },
    badgeText: { fontSize: 16, fontWeight: '600', color: Colors.theme.text },
    frameItem: { backgroundColor: Colors.theme.card, borderRadius: 10, marginBottom: 15, padding: 10, alignItems: 'center', elevation: 2 },
    framePreview: { width: 100, height: 100, resizeMode: 'contain' },
    frameName: { fontWeight: '600', marginTop: 5 },
    equippedIndicator: { position: 'absolute', top: 5, right: 5 },
    fab: { position: 'absolute', width: 56, height: 56, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 20, backgroundColor: Colors.theme.primary, borderRadius: 28, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
});
