import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { collection, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
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
interface Frame { name: string; url: string; }

// --- Componentes ---
const ProfilePostCard = ({ item, onPress }: { item: Post, onPress: () => void }) => (
    <TouchableOpacity style={styles.postItem} onPress={onPress}>
        <Image source={{ uri: item.image }} style={styles.postImage} />
    </TouchableOpacity>
);

// --- Pantalla de Perfil ---
export default function ProfileScreen() {
    const { user, logout, fetchUserProfile } = useAuth();
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [activeTab, setActiveTab] = useState<'posts' | 'badges' | 'frames'>('posts');

    const fetchPosts = useCallback(async () => {
        if (!user) {
            setLoadingPosts(false);
            return;
        }
        setLoadingPosts(true);
        try {
            const postsRef = collection(db, "posts");
            const q = query(postsRef, where("authorId", "==", user.uid), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            setUserPosts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[]);
        } catch (error) {
            console.error("Error fetching posts:", error);
        } finally {
            setLoadingPosts(false);
        }
    }, [user?.uid]);

    useFocusEffect(
      useCallback(() => {
        fetchPosts();
      }, [fetchPosts])
    );

    const pickImage = async () => {
        if (!user) return;
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5,
        });
        if (!result.canceled) uploadImage(result.assets[0].uri, user.uid);
    };

    const uploadImage = async (uri: string, uid: string) => {
        setUploading(true);
        const response = await fetch(uri);
        const blob = await response.blob();
        const storage = getStorage();
        const storageRef = ref(storage, `profile_pictures/${uid}/profile.jpg`);
        try {
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);
            await updateDoc(doc(db, "users", uid), { photoURL: downloadURL });
            await fetchUserProfile(uid);
            Alert.alert("¡Éxito!", "Tu foto de perfil ha sido actualizada.");
        } catch (error) { Alert.alert("Error", "No se pudo actualizar la foto de perfil."); } 
        finally { setUploading(false); }
    };

    const handleEquipFrame = async (frameUrl: string) => {
        if (!user) return;
        const currentEquipped = user.equippedFrameUrl;
        const newEquippedUrl = currentEquipped === frameUrl ? '' : frameUrl;
        try {
            await updateDoc(doc(db, "users", user.uid), { equippedFrameUrl: newEquippedUrl });
            await fetchUserProfile(user.uid);
        } catch (error) {
            Alert.alert("Error", "No se pudo equipar el marco.");
        }
    };

    if (!user) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <Text style={styles.emptyText}>Inicia sesión para ver tu perfil.</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                ListHeaderComponent={
                    <>
                        <View style={styles.headerContainer}>
                            <View style={styles.profileImageContainer}>
                                <Image source={{ uri: user.photoURL || 'https://placehold.co/150x150/FFDDC9/FF5C00?text=Foto' }} style={styles.profileImage} />
                                {user.equippedFrameUrl && <Image source={{ uri: user.equippedFrameUrl }} style={styles.frameImage} />}
                                <TouchableOpacity onPress={pickImage} disabled={uploading} style={styles.editIconContainer}>
                                    {uploading ? <ActivityIndicator color="#fff" size="small" /> : <FontAwesome name="camera" size={16} color="white" />}
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.name}>{user.name} {user.lastName}</Text>
                            <Text style={styles.email}>{user.email}</Text>
                            <View style={styles.statsContainer}>
                                <View style={styles.stat}><Text style={styles.statNumber}>{userPosts.length}</Text><Text style={styles.statLabel}>Posts</Text></View>
                                <View style={styles.statSeparator} />
                                <View style={styles.stat}><Text style={styles.statNumber}>{user.followersCount || 0}</Text><Text style={styles.statLabel}>Seguidores</Text></View>
                                <View style={styles.statSeparator} />
                                <View style={styles.stat}><Text style={styles.statNumber}>{user.followingCount || 0}</Text><Text style={styles.statLabel}>Siguiendo</Text></View>
                            </View>
                            <View style={styles.buttonRow}>
                                <TouchableOpacity style={[styles.profileButton, styles.editButton]} onPress={() => Alert.alert("Próximamente", "La edición de perfil estará disponible pronto.")}><Text style={styles.buttonText}>Editar Perfil</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.profileButton, styles.logoutButton]} onPress={logout}><FontAwesome name="sign-out" size={16} color={Colors.theme.grey} /></TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.tabContainer}>
                            <TouchableOpacity onPress={() => setActiveTab('posts')} style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}><FontAwesome name="th" size={20} color={activeTab === 'posts' ? Colors.theme.primary : Colors.theme.grey} /></TouchableOpacity>
                            <TouchableOpacity onPress={() => setActiveTab('badges')} style={[styles.tabButton, activeTab === 'badges' && styles.tabButtonActive]}><FontAwesome name="trophy" size={20} color={activeTab === 'badges' ? Colors.theme.primary : Colors.theme.grey} /></TouchableOpacity>
                            <TouchableOpacity onPress={() => setActiveTab('frames')} style={[styles.tabButton, activeTab === 'frames' && styles.tabButtonActive]}><FontAwesome name="image" size={20} color={activeTab === 'frames' ? Colors.theme.primary : Colors.theme.grey} /></TouchableOpacity>
                        </View>
                    </>
                }
                data={activeTab === 'posts' ? userPosts : []}
                numColumns={3}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <ProfilePostCard item={item} onPress={() => setSelectedPost(item)} />}
                ListFooterComponent={
                    <>
                        {loadingPosts && <ActivityIndicator style={{ margin: 20 }} color={Colors.theme.primary} />}
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
                    </>
                }
                ListEmptyComponent={ !loadingPosts && activeTab === 'posts' && userPosts.length === 0 ? <View style={styles.emptyContainer}><Text style={styles.emptyText}>Aún no has publicado nada.</Text></View> : null}
            />
            <PostDetailModal visible={!!selectedPost} onClose={() => setSelectedPost(null)} post={selectedPost} onPostUpdate={fetchPosts} />
        </SafeAreaView>
    );
}

const screenWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerContainer: { alignItems: 'center', paddingTop: 60, paddingBottom: 20, backgroundColor: Colors.theme.card },
    profileImageContainer: { marginBottom: 15, width: screenWidth * 0.35, height: screenWidth * 0.35, justifyContent: 'center', alignItems: 'center' },
    profileImage: { width: '100%', height: '100%', borderRadius: (screenWidth * 0.35) / 2, borderWidth: 4, borderColor: Colors.theme.primary },
    frameImage: { position: 'absolute', width: '115%', height: '115%', resizeMode: 'contain' },
    editIconContainer: { position: 'absolute', bottom: 5, right: 5, backgroundColor: Colors.theme.primary, padding: 8, borderRadius: 20 },
    uploadingOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: (screenWidth * 0.35) / 2, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    name: { fontSize: 22, fontWeight: 'bold', color: Colors.theme.text },
    email: { fontSize: 14, color: Colors.theme.grey, marginBottom: 20 },
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
    postItem: { width: (screenWidth / 3) - 2, height: (screenWidth / 3) - 2, margin: 1 },
    postImage: { width: '100%', height: '100%' },
    emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    emptyText: { fontSize: 16, color: Colors.theme.grey, textAlign: 'center' },
    itemsSection: { padding: 20 },
    badgeItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.theme.card, padding: 15, borderRadius: 10, marginBottom: 10, elevation: 2 },
    badgeEmoji: { fontSize: 30, marginRight: 15 },
    badgeText: { fontSize: 16, fontWeight: '600', color: Colors.theme.text },
    frameItem: { backgroundColor: Colors.theme.card, borderRadius: 10, marginBottom: 15, padding: 10, alignItems: 'center', elevation: 2 },
    framePreview: { width: 100, height: 100, resizeMode: 'contain' },
    frameName: { fontWeight: '600', marginTop: 5 },
    equippedIndicator: { position: 'absolute', top: 5, right: 5 }
});
