import { PostDetailModal } from '@/components/PostDetailModal'; // Asegúrate que la ruta sea correcta
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { arrayRemove, arrayUnion, collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';

// --- Interfaces ---
interface Post {
    id: string;
    type: 'recipe' | 'story';
    title: string;
    description?: string;
    image: string;
    authorId: string;
    authorName: string;
    authorPhoto: string;
    createdAt: any;
    likes: string[];
    commentCount?: number;
}

// --- Componente de Tarjeta de Publicación ---
const PostCard = ({ item, onOpenPost, onLike, userId }: { item: Post, onOpenPost: () => void, onLike: () => void, userId: string | null }) => {
    const router = useRouter();
    const isLiked = userId ? item.likes.includes(userId) : false;

    // Navega al perfil del autor al tocar el header
    const navigateToProfile = () => {
        router.push(`/profile/${item.authorId}`);
    };

    return (
        <View style={styles.card}>
            <TouchableOpacity onPress={navigateToProfile} style={styles.cardHeader}>
                <Image source={{ uri: item.authorPhoto || 'https://placehold.co/40x40' }} style={styles.authorImage} />
                <Text style={styles.authorName}>{item.authorName}</Text>
            </TouchableOpacity>
            
            {/* La imagen es clickeable para abrir los detalles */}
            <TouchableOpacity onPress={onOpenPost}>
                <Image source={{ uri: item.image }} style={styles.cardImage} />
            </TouchableOpacity>

            <View style={styles.cardFooter}>
                <View style={styles.actionsContainer}>
                    <TouchableOpacity onPress={onLike} style={styles.actionButton}>
                        <FontAwesome name={isLiked ? "heart" : "heart-o"} size={24} color={isLiked ? Colors.theme.primary : Colors.theme.grey} />
                        <Text style={styles.actionText}>{item.likes.length}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onOpenPost} style={styles.actionButton}>
                        <FontAwesome name="comment-o" size={24} color={Colors.theme.grey} />
                        <Text style={styles.actionText}>{item.commentCount || 0}</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={onOpenPost}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {item.description && <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
};

// --- Pantalla de Comunidad ---
export default function CommunityScreen() {
    const router = useRouter();
    const { user, promptLogin } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const postsRef = collection(db, "posts");
            const q = query(postsRef, orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);

            const postsDataPromises = querySnapshot.docs.map(async (doc) => {
                const postData = { id: doc.id, ...doc.data() } as Post;
                const commentsRef = collection(db, "posts", doc.id, "comments");
                const commentsSnapshot = await getDocs(commentsRef);
                postData.commentCount = commentsSnapshot.size;
                return postData;
            });

            const postsDataWithCounts = await Promise.all(postsDataPromises);
            setPosts(postsDataWithCounts);

        } catch (e) {
            console.error("Failed to load posts.", e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchPosts(); }, []));

    const handleLike = async (postId: string) => {
        if (!user) {
            promptLogin();
            return;
        }
        const postRef = doc(db, "posts", postId);
        const post = posts.find(p => p.id === postId);
        if (!post) return;
        
        const isLiked = post.likes.includes(user.uid);

        try {
            await updateDoc(postRef, {
                likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
            });
            setPosts(prevPosts => prevPosts.map(p => 
                p.id === postId 
                ? { ...p, likes: isLiked ? p.likes.filter(uid => uid !== user.uid) : [...p.likes, user.uid] }
                : p
            ));
        } catch (error) {
            console.error("Error al dar like:", error);
        }
    };

    const handleAddPost = () => {
        if (!user) {
            promptLogin();
        } else {
            router.push('/createPost');
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Comunidad</Text>
                <TouchableOpacity onPress={handleAddPost} style={styles.addButton}>
                    <FontAwesome name="plus" size={20} color={Colors.theme.primary} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={Colors.theme.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={posts}
                    renderItem={({ item }) => (
                        <PostCard 
                            item={item} 
                            onOpenPost={() => setSelectedPost(item)} 
                            onLike={() => handleLike(item.id)}
                            userId={user?.uid || null}
                        />
                    )}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>¡Sé el primero en compartir algo!</Text>
                        </View>
                    }
                />
            )}

            <PostDetailModal 
                visible={!!selectedPost}
                onClose={() => setSelectedPost(null)}
                post={selectedPost}
                onPostUpdate={fetchPosts}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 10, backgroundColor: Colors.theme.card, borderBottomWidth: 1, borderBottomColor: '#eee' },
    headerTitle: { fontSize: 32, fontWeight: 'bold', color: Colors.theme.text },
    addButton: { padding: 8, backgroundColor: '#e9e9e9', borderRadius: 20 },
    listContent: { paddingVertical: 10 },
    card: { backgroundColor: Colors.theme.card, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 10 },
    authorImage: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
    authorName: { fontWeight: 'bold', color: Colors.theme.text },
    cardImage: { width: '100%', height: 400 },
    cardFooter: { padding: 15 },
    actionsContainer: { flexDirection: 'row', marginBottom: 10 },
    actionButton: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
    actionText: { marginLeft: 5, color: Colors.theme.grey, fontWeight: '600' },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.theme.text, marginBottom: 5 },
    cardDescription: { fontSize: 14, color: Colors.theme.text, marginTop: 5 },
    cardDate: { fontSize: 12, color: Colors.theme.grey, marginTop: 5 },
    emptyContainer: { marginTop: 50, alignItems: 'center' },
    emptyText: { fontSize: 16, color: Colors.theme.grey },
});
