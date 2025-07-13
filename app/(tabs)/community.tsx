import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, documentId, getDocs, limit, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { deleteObject, getStorage, ref } from "firebase/storage";
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PostDetailModal } from '../../components/PostDetailModal';
import ProfilePicture from '../../components/ProfilePicture';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';

// --- Interfaces ---
interface Comment { id: string; text: string; userName: string; }
interface Post { id: string; title: string; image: string; likes: string[]; authorId: string; authorName: string; authorPhoto: string; description?: string; createdAt: any; authorFrameUrl?: string; authorBadges?: string[]; commentCount: number; lastComment?: Comment; }
interface AuthorsData { [key: string]: { equippedFrameUrl?: string; badges?: string[]; }; }

// --- Componente PostCard ---
const PostCard = ({ item, onLike, onSelectPost, onAuthorPress, onDelete, currentUserId }: { item: Post, onLike: (id: string) => void, onSelectPost: (post: Post) => void, onAuthorPress: (authorId: string) => void, onDelete: (postId: string, imageUrl: string) => void, currentUserId?: string }) => {
    const isLiked = currentUserId ? item.likes.includes(currentUserId) : false;
    const isOwner = currentUserId === item.authorId;
    const featuredBadge = item.authorBadges && item.authorBadges.length > 0 ? item.authorBadges[item.authorBadges.length - 1] : null;

    const showDeleteConfirm = () => {
        Alert.alert( "Eliminar Publicación", "¿Estás seguro de que quieres eliminar esta publicación? Esta acción no se puede deshacer.",
            [ { text: "Cancelar", style: "cancel" }, { text: "Eliminar", style: "destructive", onPress: () => onDelete(item.id, item.image) } ]
        );
    };

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <TouchableOpacity onPress={() => onAuthorPress(item.authorId)} style={styles.authorTouchable}>
                    <ProfilePicture photoURL={item.authorPhoto} frameURL={item.authorFrameUrl} size={44} borderColor={Colors.theme.background} borderWidth={2} />
                    <View style={styles.authorInfo}>
                        <Text style={styles.authorName}>{item.authorName}</Text>
                        {featuredBadge && (
                            <View style={styles.badgeContainer}>
                                <FontAwesome name="trophy" size={12} color="#D4AF37" />
                                <Text style={styles.badgeText} numberOfLines={1}>{featuredBadge}</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
                {isOwner && (
                    <TouchableOpacity onPress={showDeleteConfirm} style={styles.deleteButton}>
                        <FontAwesome name="trash-o" size={24} color={Colors.theme.grey} />
                    </TouchableOpacity>
                )}
            </View>
            <TouchableOpacity onPress={() => onSelectPost(item)}>
                <Image source={{ uri: item.image }} style={styles.cardImage} />
            </TouchableOpacity>
            <View style={styles.cardFooter}>
                <View style={styles.actionsContainer}>
                    <TouchableOpacity onPress={() => onLike(item.id)} style={styles.actionButton}>
                        <FontAwesome name={isLiked ? "heart" : "heart-o"} size={26} color={isLiked ? Colors.theme.primary : Colors.theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onSelectPost(item)} style={styles.actionButton}>
                        <FontAwesome name="comment-o" size={24} color={Colors.theme.text} />
                    </TouchableOpacity>
                </View>
                <Text style={styles.likesCount}>{item.likes.length} Me gusta</Text>
                <Text style={styles.postTitle} numberOfLines={2}><Text style={{fontWeight: 'bold'}}>{item.authorName}</Text> {item.title}</Text>
                
                {item.commentCount > 0 && (
                    <TouchableOpacity onPress={() => onSelectPost(item)}>
                        <Text style={styles.viewCommentsText}>Ver los {item.commentCount} comentarios</Text>
                    </TouchableOpacity>
                )}
                {item.lastComment && (
                    <View style={styles.lastCommentContainer}>
                        <Text style={styles.lastCommentText} numberOfLines={1}>
                            <Text style={{fontWeight: 'bold'}}>{item.lastComment.userName}</Text> {item.lastComment.text}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
};

// --- Pantalla de Comunidad ---
export default function CommunityScreen() {
    const { user, promptLogin } = useAuth();
    const router = useRouter();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);

    const fetchPostsAndDetails = useCallback(async () => {
        setLoading(true);
        try {
            const postsRef = collection(db, "posts");
            const qPosts = query(postsRef, orderBy("createdAt", "desc"), limit(20));
            const postsSnapshot = await getDocs(qPosts);
            const postsData = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];

            if (postsData.length === 0) {
                setPosts([]);
                return;
            }

            const authorIds = [...new Set(postsData.map(p => p.authorId))];
            const usersRef = collection(db, "users");
            const qUsers = query(usersRef, where(documentId(), "in", authorIds));
            const usersSnapshot = await getDocs(qUsers);
            const authorsData: AuthorsData = {};
            usersSnapshot.forEach(doc => {
                const data = doc.data();
                authorsData[doc.id] = {
                    equippedFrameUrl: data.equippedFrameUrl,
                    badges: data.badges
                };
            });

            const postsWithDetails = await Promise.all(postsData.map(async (post) => {
                const commentsRef = collection(db, "posts", post.id, "comments");
                const qComments = query(commentsRef, orderBy("createdAt", "desc"), limit(1));
                const commentsSnapshot = await getDocs(qComments);
                const commentDocs = commentsSnapshot.docs;
                
                const allCommentsSnapshot = await getDocs(collection(db, "posts", post.id, "comments"));

                return {
                    ...post,
                    authorFrameUrl: authorsData[post.authorId]?.equippedFrameUrl,
                    authorBadges: authorsData[post.authorId]?.badges,
                    commentCount: allCommentsSnapshot.size,
                    lastComment: commentDocs.length > 0 ? (commentDocs[0].data() as Comment) : undefined,
                };
            }));
            setPosts(postsWithDetails);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchPostsAndDetails();
        }, [fetchPostsAndDetails])
    );
    
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchPostsAndDetails();
    }, [fetchPostsAndDetails]);


    const handleLike = async (postId: string) => {
        if (!user) {
            promptLogin();
            return;
        }
        const postRef = doc(db, "posts", postId);
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        const isLiked = post.likes.includes(user.uid);
        const newLikes = isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid);

        setPosts(posts.map(p => p.id === postId ? { ...p, likes: isLiked ? p.likes.filter(uid => uid !== user.uid) : [...p.likes, user.uid] } : p));
        await updateDoc(postRef, { likes: newLikes });
    };

    const handleAuthorPress = (authorId: string) => {
        if (authorId === user?.uid) {
            router.push('/(tabs)/profile');
        } else {
            router.push(`/profile/${authorId}`);
        }
    };

    const handleDeletePost = async (postId: string, imageUrl: string) => {
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

            setPosts(prevPosts => prevPosts.filter(p => p.id !== postId));
            Alert.alert("Éxito", "La publicación ha sido eliminada.");

        } catch (error : any) {
            console.error("Error deleting post: ", error);
            if (error.code === 'storage/object-not-found') {
                 setPosts(prevPosts => prevPosts.filter(p => p.id !== postId));
                 Alert.alert("Publicación Eliminada", "La publicación fue eliminada, pero la imagen no se encontró en el servidor.");
            } else {
                Alert.alert("Error", "No se pudo eliminar la publicación.");
            }
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {loading && !refreshing ? (
                <ActivityIndicator style={{ flex: 1 }} size="large" color={Colors.theme.primary} />
            ) : (
                <FlatList
                    data={posts}
                    renderItem={({ item }) => <PostCard item={item} onLike={handleLike} onSelectPost={setSelectedPost} onAuthorPress={handleAuthorPress} onDelete={handleDeletePost} currentUserId={user?.uid} />}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingVertical: 10 }}
                    ListHeaderComponent={<Text style={styles.headerTitle}>Comunidad</Text>}
                    ListEmptyComponent={<Text style={styles.emptyText}>No hay publicaciones aún. ¡Sé el primero!</Text>}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.theme.primary]} />
                    }
                />
            )}
            <TouchableOpacity style={styles.fab} onPress={() => router.push('/createPost')}>
                <FontAwesome name="plus" size={24} color="white" />
            </TouchableOpacity>
            <PostDetailModal
                visible={!!selectedPost}
                onClose={() => setSelectedPost(null)}
                post={selectedPost}
                onPostUpdate={fetchPostsAndDetails}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: Colors.theme.text, paddingHorizontal: 15, paddingBottom: 5, paddingTop: 10 },
    card: { backgroundColor: Colors.theme.card, borderRadius: 15, marginHorizontal: 15, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, justifyContent: 'space-between' },
    authorTouchable: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    authorInfo: { marginLeft: 10, flex: 1 },
    authorName: { fontWeight: 'bold', fontSize: 16 },
    badgeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 2 },
    badgeText: { marginLeft: 4, fontSize: 11, fontWeight: '600', color: '#B45309' },
    deleteButton: { padding: 8 },
    cardImage: { width: '100%', height: 350 },
    cardFooter: { paddingHorizontal: 15, paddingVertical: 12 },
    actionsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    actionButton: { marginRight: 15 },
    likesCount: { fontWeight: 'bold', marginBottom: 5 },
    postTitle: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
    viewCommentsText: { color: Colors.theme.grey, fontWeight: '500', marginBottom: 4 },
    lastCommentContainer: { flexDirection: 'row' },
    lastCommentText: { color: Colors.theme.text, fontSize: 14 },
    emptyText: { textAlign: 'center', marginTop: 50, color: Colors.theme.grey },
    fab: { position: 'absolute', width: 56, height: 56, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 20, backgroundColor: Colors.theme.primary, borderRadius: 28, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
});
