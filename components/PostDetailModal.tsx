import { FontAwesome } from '@expo/vector-icons';
import { addDoc, arrayRemove, arrayUnion, collection, doc, documentId, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth, UserProfile } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import ProfilePicture from './ProfilePicture';

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

interface Comment {
    id: string;
    text: string;
    userId: string;
    userName:string;
    userPhoto: string;
    createdAt: any;
    userFrameUrl?: string;
    userBadges?: string[];
    likes?: string[];
}

const EMOJI_REACTIONS = ['❤️', '😂', '👍', '🔥', '😢', '😍', '👏'];

// --- Componente de Comentario ---
const CommentCard = ({ comment, onLike, currentUserId }: { comment: Comment, onLike: (commentId: string) => void, currentUserId?: string }) => {
    const featuredBadge = comment.userBadges && comment.userBadges.length > 0 ? comment.userBadges[0] : null;
    const isLiked = currentUserId && comment.likes?.includes(currentUserId);

    return (
        <View style={styles.commentContainer}>
            <ProfilePicture photoURL={comment.userPhoto} frameURL={comment.userFrameUrl} size={40} />
            <View style={styles.commentTextContainer}>
                <View style={styles.commentHeader}>
                    <Text style={styles.commentUserName}>{comment.userName}</Text>
                    {featuredBadge && (
                        <View style={styles.commentBadgeContainer}>
                            <FontAwesome name="trophy" size={12} color="#D4AF37" />
                            <Text style={styles.commentBadgeText} numberOfLines={1}>{featuredBadge}</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.commentText}>{comment.text}</Text>
                <View style={styles.commentFooter}>
                    <TouchableOpacity onPress={() => onLike(comment.id)} style={styles.commentActionButton}>
                        <FontAwesome name={isLiked ? "heart" : "heart-o"} size={16} color={isLiked ? Colors.theme.primary : Colors.theme.grey} />
                        {comment.likes && comment.likes.length > 0 && <Text style={styles.commentLikeCount}>{comment.likes.length}</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

// --- Componente Principal del Modal ---
export const PostDetailModal = ({ visible, onClose, post, onPostUpdate }: { visible: boolean, onClose: () => void, post: Post | null, onPostUpdate: () => void }) => {
    const { user, promptLogin } = useAuth();
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [author, setAuthor] = useState<UserProfile | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        if (post) {
            setIsLiked(user ? post.likes.includes(user.uid) : false);
            setLikeCount(post.likes.length);
            setComments([]);
            
            const fetchAuthor = async () => {
                const userDoc = await getDoc(doc(db, "users", post.authorId));
                if (userDoc.exists()) setAuthor(userDoc.data() as UserProfile);
            };
            fetchAuthor();

            const commentsRef = collection(db, "posts", post.id, "comments");
            const q = query(commentsRef, orderBy("createdAt", "asc"));
            const unsubscribe = onSnapshot(q, async (snapshot) => {
                const fetchedCommentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Comment[];
                if (fetchedCommentsData.length > 0) {
                    const userIds = [...new Set(fetchedCommentsData.map(c => c.userId))];
                    const usersRef = collection(db, "users");
                    const qUsers = query(usersRef, where(documentId(), "in", userIds));
                    const usersSnapshot = await getDocs(qUsers);
                    
                    const usersData: {[key: string]: Partial<UserProfile>} = {};
                    usersSnapshot.forEach(doc => {
                        const data = doc.data();
                        usersData[doc.id] = { equippedFrameUrl: data.equippedFrameUrl, badges: data.badges };
                    });

                    const finalComments = fetchedCommentsData.map(comment => ({
                        ...comment,
                        userFrameUrl: usersData[comment.userId]?.equippedFrameUrl,
                        userBadges: usersData[comment.userId]?.badges,
                    }));
                    setComments(finalComments);
                } else {
                    setComments([]);
                }
            });
            return () => unsubscribe();
        }
    }, [post, user]);

    const handleLikePost = async () => {
        if (!user || !post) {
            promptLogin();
            return;
        }

        const originalIsLiked = isLiked;
        const originalLikeCount = likeCount;
        const newIsLiked = !isLiked;
        const newLikeCount = newIsLiked ? likeCount + 1 : likeCount - 1;

        // Actualización optimista de la UI
        setIsLiked(newIsLiked);
        setLikeCount(newLikeCount);

        try {
            const postRef = doc(db, "posts", post.id);
            await updateDoc(postRef, {
                likes: newIsLiked ? arrayUnion(user.uid) : arrayRemove(user.uid)
            });
            onPostUpdate();
        } catch (error) {
            // Si hay un error, revierte los cambios en la UI
            setIsLiked(originalIsLiked);
            setLikeCount(originalLikeCount);
            Alert.alert("Error", "No se pudo procesar el 'Me gusta'.");
        }
    };

    const handleLikeComment = async (commentId: string) => {
        if (!user || !post) {
            promptLogin();
            return;
        }

        const originalComments = [...comments];
        const commentIndex = comments.findIndex(c => c.id === commentId);
        if (commentIndex === -1) return;

        const comment = comments[commentIndex];
        const isCommentLiked = comment.likes?.includes(user.uid);
        const newLikes = isCommentLiked
            ? (comment.likes || []).filter(uid => uid !== user.uid)
            : [...(comment.likes || []), user.uid];

        const updatedComments = [...comments];
        updatedComments[commentIndex] = {
            ...comment,
            likes: newLikes
        };

        // Actualización optimista
        setComments(updatedComments);

        try {
            const commentRef = doc(db, "posts", post.id, "comments", commentId);
            await updateDoc(commentRef, { likes: newLikes ? arrayUnion(user.uid) : arrayRemove(user.uid) });
        } catch (error) {
            // Revertir en caso de error
            setComments(originalComments);
            console.error(error);
            Alert.alert("Error", "No se pudo dar 'Me gusta' al comentario.");
        }
    };
    
    const handleAddComment = async () => {
        if (!user || !post || !newComment.trim()) {
            if (!user) promptLogin();
            return;
        }
        setIsSubmitting(true);
        try {
            const commentsRef = collection(db, "posts", post.id, "comments");
            await addDoc(commentsRef, {
                text: newComment.trim(),
                userId: user.uid,
                userName: `${user.name} ${user.lastName}`,
                userPhoto: user.photoURL,
                createdAt: serverTimestamp(),
                likes: [],
            });
            setNewComment('');
            setShowEmojiPicker(false);
            Keyboard.dismiss();
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 300);
            onPostUpdate(); // Actualizar el conteo de comentarios en la vista de la comunidad
        } catch (error) { Alert.alert("Error", "No se pudo añadir el comentario."); } 
        finally { setIsSubmitting(false); }
    };

    if (!post) return null;

    return (
        <Modal animationType="slide" transparent={false} visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
                    <View style={styles.header}>
                        <ProfilePicture photoURL={author?.photoURL} frameURL={author?.equippedFrameUrl} size={40} />
                        <Text style={styles.authorName}>{post.authorName}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}><FontAwesome name="close" size={24} color={Colors.theme.text} /></TouchableOpacity>
                    </View>
                    <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent}>
                        <Image source={{ uri: post.image }} style={styles.postImage} />
                        <View style={styles.contentContainer}>
                            <Text style={styles.postTitle}>{post.title}</Text>
                            <Text style={styles.description}>{post.description}</Text>
                            <View style={styles.actionsContainer}>
                                <TouchableOpacity onPress={handleLikePost} style={styles.actionButton}>
                                    <FontAwesome name={isLiked ? "heart" : "heart-o"} size={24} color={isLiked ? Colors.theme.primary : Colors.theme.text} />
                                    <Text style={styles.likeCount}>{likeCount}</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.separator} />
                            <Text style={styles.commentsTitle}>Comentarios ({comments.length})</Text>
                            {comments.map(comment => <CommentCard key={comment.id} comment={comment} onLike={handleLikeComment} currentUserId={user?.uid} />)}
                        </View>
                    </ScrollView>
                    <View style={styles.commentInputContainer}>
                        <TouchableOpacity onPress={() => setShowEmojiPicker(!showEmojiPicker)} style={styles.emojiButton}>
                            <FontAwesome name="smile-o" size={24} color={Colors.theme.grey} />
                        </TouchableOpacity>
                        <TextInput style={styles.input} placeholder="Añade un comentario..." value={newComment} onChangeText={setNewComment} multiline onFocus={() => setShowEmojiPicker(false)} />
                        <TouchableOpacity onPress={handleAddComment} disabled={isSubmitting} style={styles.sendButton}>
                            {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome name="paper-plane" size={20} color="#fff" />}
                        </TouchableOpacity>
                    </View>
                    {showEmojiPicker && (
                        <View style={styles.emojiPickerContainer}>
                            {EMOJI_REACTIONS.map(emoji => (
                                <TouchableOpacity key={emoji} onPress={() => setNewComment(prev => prev + emoji)}>
                                    <Text style={styles.emoji}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Colors.theme.card },
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    authorName: { flex: 1, marginLeft: 10, fontSize: 16, fontWeight: 'bold' },
    closeButton: { padding: 5 },
    scrollContent: { paddingBottom: 20 },
    postImage: { width: '100%', height: 350 },
    contentContainer: { padding: 20 },
    postTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
    description: { fontSize: 16, lineHeight: 24, color: Colors.theme.grey },
    actionsContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
    actionButton: { flexDirection: 'row', alignItems: 'center' },
    likeCount: { marginLeft: 8, fontSize: 16, fontWeight: '600' },
    separator: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
    commentsTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    commentContainer: { flexDirection: 'row', marginBottom: 15, alignItems: 'flex-start' },
    commentTextContainer: { marginLeft: 10, flex: 1, backgroundColor: '#f0f2f5', padding: 10, borderRadius: 10 },
    commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' },
    commentUserName: { fontWeight: 'bold', marginRight: 8 },
    commentBadgeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
    commentBadgeText: { marginLeft: 4, fontSize: 11, fontWeight: '600', color: '#B45309' },
    commentText: { color: Colors.theme.text },
    commentFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 8, },
    commentActionButton: { flexDirection: 'row', alignItems: 'center', marginRight: 15, },
    commentLikeCount: { marginLeft: 5, fontSize: 14, color: Colors.theme.grey, fontWeight: '600' },
    commentInputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: Colors.theme.card },
    input: { flex: 1, backgroundColor: '#f0f2f5', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, maxHeight: 100, marginLeft: 10 },
    emojiButton: { padding: 5 },
    sendButton: { marginLeft: 10, backgroundColor: Colors.theme.primary, padding: 12, borderRadius: 25 },
    emojiPickerContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, backgroundColor: '#f9f9f9', borderTopWidth: 1, borderTopColor: '#eee' },
    emoji: { fontSize: 28 },
});