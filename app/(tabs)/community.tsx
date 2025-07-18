import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, documentId, getDocs, limit, orderBy, query, QueryDocumentSnapshot, startAfter, updateDoc, where, writeBatch } from 'firebase/firestore';
import { deleteObject, getStorage, ref } from "firebase/storage";
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LikesModal } from '../../components/LikesModal';
import { PostDetailModal } from '../../components/PostDetailModal';
import ProfilePicture from '../../components/ProfilePicture';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';

// --- Interfaces ---
interface Comment { id: string; text: string; userName: string; }
interface Post { id: string; title: string; image: string; likes: string[]; authorId: string; authorName: string; authorPhoto: string; description?: string; createdAt: any; authorFrameUrl?: string; authorBadges?: string[]; commentCount: number; lastComment?: Comment; }
interface AuthorsData { [key: string]: { equippedFrameUrl?: string; badges?: string[]; }; }

// --- Utilidad para barajar un array ---
const shuffleArray = (array: any[]) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// --- Componente PostCard (sin cambios) ---
const PostCard = ({ item, onLike, onSelectPost, onAuthorPress, onDelete, currentUserId, onOpenLikesModal }: { item: Post, onLike: (id: string) => void, onSelectPost: (post: Post) => void, onAuthorPress: (authorId: string) => void, onDelete: (postId: string, imageUrl: string) => void, currentUserId?: string, onOpenLikesModal: (likerIds: string[]) => void }) => {
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
                <TouchableOpacity onPress={() => onOpenLikesModal(item.likes)}>
                    <Text style={styles.likesCount}>{item.likes.length} Me gusta</Text>
                </TouchableOpacity>
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
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [isLikesModalVisible, setIsLikesModalVisible] = useState(false);
    const [selectedPostLikerIds, setSelectedPostLikerIds] = useState<string[]>([]);
    const [feedType, setFeedType] = useState<'foryou' | 'following'>('foryou');
    const [isFetching, setIsFetching] = useState(false);

    const handleOpenLikesModal = (likerIds: string[]) => {
        if (likerIds.length === 0) return;
        setSelectedPostLikerIds(likerIds);
        setIsLikesModalVisible(true);
    };

    const fetchPosts = useCallback(async (isInitialLoad = false) => {
        if (isFetching) return;
        setIsFetching(true);

        if (isInitialLoad) {
            setLoading(true);
            setPosts([]);
            setLastVisible(null);
        } else {
            setLoadingMore(true);
        }
    
        try {
            const postsRef = collection(db, "posts");
            let q;
    
            if (feedType === 'following' && user) {
                const followingRef = collection(db, "users", user.uid, "following");
                const followingSnapshot = await getDocs(followingRef);
                const followingIds = followingSnapshot.docs.map(doc => doc.id);
    
                if (followingIds.length === 0) {
                    setPosts([]);
                    setIsFetching(false);
                    setLoading(false);
                    setLoadingMore(false);
                    setRefreshing(false);
                    return;
                }
                
                const baseQuery = query(postsRef, where("authorId", "in", followingIds), orderBy("createdAt", "desc"), limit(15));
                q = isInitialLoad || !lastVisible ? baseQuery : query(baseQuery, startAfter(lastVisible));
            } else {
                const baseQuery = query(postsRef, orderBy("createdAt", "desc"), limit(15));
                q = isInitialLoad || !lastVisible ? baseQuery : query(baseQuery, startAfter(lastVisible));
            }
    
            const postsSnapshot = await getDocs(q);
            if (postsSnapshot.empty) {
                setIsFetching(false);
                setLoading(false);
                setLoadingMore(false);
                setRefreshing(false);
                return;
            }
    
            const newLastVisible = postsSnapshot.docs[postsSnapshot.docs.length - 1];
            setLastVisible(newLastVisible);
    
            const postsData = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
    
            const authorIds = [...new Set(postsData.map(p => p.authorId))];
            if (authorIds.length > 0) {
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
    
                let finalPosts = isInitialLoad ? postsWithDetails : [...posts, ...postsWithDetails];
                if (feedType === 'foryou' && isInitialLoad) {
                    finalPosts = shuffleArray(finalPosts);
                }
                setPosts(finalPosts);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsFetching(false);
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    }, [user, feedType, lastVisible, isFetching]);

    useEffect(() => {
        if (user) {
            fetchPosts(true);
        } else {
            setLoading(false);
        }
    }, [feedType, user]);
    
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchPosts(true);
    }, [feedType]);


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
    
    const renderFooter = () => {
        if (!loadingMore) return null;
        return <ActivityIndicator style={{ marginVertical: 20 }} size="large" color={Colors.theme.primary} />;
    };

    const GuestView = () => (
        <View style={styles.guestContainer}>
            <FontAwesome name="users" size={50} color={Colors.theme.grey} />
            <Text style={styles.guestTitle}>Únete a la Comunidad</Text>
            <Text style={styles.guestSubtitle}>Inicia sesión para ver lo que otros cocinan, compartir tus platos y conectar con más sazonadores.</Text>
            <TouchableOpacity style={styles.guestButton} onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.guestButtonText}>Iniciar Sesión o Registrarse</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {!user ? <GuestView /> : (
                <>
                    {loading && posts.length === 0 ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={Colors.theme.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={posts}
                            renderItem={({ item }) => <PostCard item={item} onLike={handleLike} onSelectPost={setSelectedPost} onAuthorPress={handleAuthorPress} onDelete={handleDeletePost} currentUserId={user?.uid} onOpenLikesModal={handleOpenLikesModal} />}
                            keyExtractor={item => item.id}
                            contentContainerStyle={{ paddingVertical: 10 }}
                            ListHeaderComponent={
                                <View style={styles.header}>
                                    <View style={styles.feedTypeContainer}>
                                        <TouchableOpacity onPress={() => setFeedType('foryou')} style={[styles.feedTypeButton, feedType === 'foryou' && styles.feedTypeButtonActive]}>
                                            <Text style={[styles.feedTypeText, feedType === 'foryou' && styles.feedTypeTextActive]}>Para ti</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setFeedType('following')} style={[styles.feedTypeButton, feedType === 'following' && styles.feedTypeButtonActive]}>
                                            <Text style={[styles.feedTypeText, feedType === 'following' && styles.feedTypeTextActive]}>Siguiendo</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            }
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <FontAwesome name="users" size={40} color={Colors.theme.grey} />
                                    <Text style={styles.emptyText}>{feedType === 'foryou' ? '¡Sé el primero en compartir!' : 'Sigue a otros para ver sus posts aquí.'}</Text>
                                    <Text style={styles.emptySubtext}>{feedType === 'foryou' ? "Toca el botón '+' para subir tu primera creación." : 'Usa el buscador en tu perfil.'}</Text>
                                </View>
                            }
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.theme.primary]} tintColor={Colors.theme.primary}/>
                            }
                            onEndReached={() => fetchPosts()}
                            onEndReachedThreshold={0.5}
                            ListFooterComponent={renderFooter}
                        />
                    )}
                    <TouchableOpacity style={styles.fab} onPress={() => router.push('/createPost')}>
                        <FontAwesome name="plus" size={24} color="white" />
                    </TouchableOpacity>
                    <PostDetailModal
                        visible={!!selectedPost}
                        onClose={() => setSelectedPost(null)}
                        post={selectedPost}
                        onPostUpdate={onRefresh}
                    />
                    <LikesModal
                        visible={isLikesModalVisible}
                        onClose={() => setIsLikesModalVisible(false)}
                        likerIds={selectedPostLikerIds}
                    />
                </>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    guestContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    guestTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.theme.text,
        textAlign: 'center',
        marginTop: 20,
    },
    guestSubtitle: {
        fontSize: 16,
        color: Colors.theme.grey,
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 30,
    },
    guestButton: {
        backgroundColor: Colors.theme.secondary,
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: 30,
    },
    guestButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    header: {
        paddingTop: 50,
        paddingBottom: 10,
        paddingHorizontal: 20,
    },
    feedTypeContainer: {
        flexDirection: 'row',
        marginTop: 15,
        backgroundColor: '#e9ecef',
        borderRadius: 20,
        alignSelf: 'center',
    },
    feedTypeButton: {
        paddingVertical: 10,
        paddingHorizontal: 25,
        borderRadius: 20,
    },
    feedTypeButtonActive: {
        backgroundColor: Colors.theme.secondary,
    },
    feedTypeText: {
        fontWeight: 'bold',
        color: Colors.theme.grey,
    },
    feedTypeTextActive: {
        color: Colors.theme.textLight,
    },
    card: { 
        backgroundColor: Colors.theme.card, 
        borderRadius: 15, 
        marginHorizontal: 15, 
        marginBottom: 25, 
        shadowColor: "#000", 
        shadowOffset: { width: 0, height: 4 }, 
        shadowOpacity: 0.1, 
        shadowRadius: 12, 
        elevation: 5 
    },
    cardHeader: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 12, 
        justifyContent: 'space-between' 
    },
    authorTouchable: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        flex: 1 
    },
    authorInfo: { 
        marginLeft: 12, 
        flex: 1 
    },
    authorName: { 
        fontWeight: 'bold', 
        fontSize: 16 
    },
    badgeContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#FFFBEB', 
        borderRadius: 10, 
        paddingHorizontal: 6, 
        paddingVertical: 2, 
        alignSelf: 'flex-start', 
        marginTop: 2 
    },
    badgeText: { 
        marginLeft: 4, 
        fontSize: 11, 
        fontWeight: '600', 
        color: '#B45309' 
    },
    deleteButton: { 
        padding: 8 
    },
    cardImage: { 
        width: '100%', 
        height: 400,
        backgroundColor: '#f0f0f0',
    },
    cardFooter: { 
        paddingHorizontal: 15, 
        paddingVertical: 12 
    },
    actionsContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginBottom: 8 
    },
    actionButton: { 
        marginRight: 18 
    },
    likesCount: { 
        fontWeight: 'bold', 
        marginBottom: 5 
    },
    postTitle: { 
        fontSize: 14, 
        lineHeight: 20, 
        marginBottom: 8 
    },
    viewCommentsText: { 
        color: Colors.theme.grey, 
        fontWeight: '500', 
        marginBottom: 4 
    },
    lastCommentContainer: { 
        flexDirection: 'row' 
    },
    lastCommentText: { 
        color: Colors.theme.text, 
        fontSize: 14 
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        marginTop: 50,
    },
    emptyText: { 
        fontSize: 18, 
        fontWeight: '600', 
        color: Colors.theme.grey, 
        textAlign: 'center',
        marginTop: 15,
    },
    emptySubtext: {
        fontSize: 14,
        color: Colors.theme.grey,
        textAlign: 'center',
        marginTop: 8,
    },
    fab: { 
        position: 'absolute', 
        width: 60, 
        height: 60, 
        alignItems: 'center', 
        justifyContent: 'center', 
        right: 20, 
        bottom: 30, 
        backgroundColor: Colors.theme.secondary, 
        borderRadius: 30, 
        elevation: 8, 
        shadowColor: '#000', 
        shadowOpacity: 0.2, 
        shadowRadius: 5, 
        shadowOffset: { width: 0, height: 4 } 
    },
});
