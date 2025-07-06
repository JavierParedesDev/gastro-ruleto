import { FontAwesome } from '@expo/vector-icons';
import { addDoc, arrayRemove, arrayUnion, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';

// --- Interfaces ---
interface Post {
    id: string;
    title: string;
    description?: string;
    image: string;
    likes: string[];
    authorId: string;
    authorName: string;
    authorPhoto: string;
}

interface Comment {
    id: string;
    text: string;
    userName: string;
    createdAt: any;
}

// --- Componente ---
export const PostDetailModal = ({ visible, onClose, post, onPostUpdate }: { visible: boolean, onClose: () => void, post: Post | null, onPostUpdate: () => void }) => {
    const { user, promptLogin } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [loadingComments, setLoadingComments] = useState(true);
    const [newComment, setNewComment] = useState('');

    useEffect(() => {
        if (post && visible) {
            fetchComments();
        }
    }, [post, visible]);

    const fetchComments = async () => {
        if (!post) return;
        setLoadingComments(true);
        try {
            const commentsRef = collection(db, "posts", post.id, "comments");
            const q = query(commentsRef, orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const fetchedComments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Comment[];
            setComments(fetchedComments);
        } catch (error) {
            console.error("Error fetching comments:", error);
        } finally {
            setLoadingComments(false);
        }
    };

    const handleLike = async () => {
        if (!user) { promptLogin(); return; }
        if (!post) return;

        const postRef = doc(db, "posts", post.id);
        const isLiked = post.likes.includes(user.uid);
        try {
            await updateDoc(postRef, {
                likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
            });
            onPostUpdate(); // Notifica a la pantalla padre que debe refrescar los datos
        } catch (error) {
            console.error("Error al dar like:", error);
        }
    };

    const handleCommentSubmit = async () => {
        if (!user) { promptLogin(); return; }
        if (!post || newComment.trim() === '') return;

        try {
            await addDoc(collection(db, "posts", post.id, "comments"), {
                text: newComment,
                userName: `${user.name} ${user.lastName}`,
                userId: user.uid,
                createdAt: serverTimestamp(),
            });
            setNewComment('');
            fetchComments(); // Refrescar comentarios
            onPostUpdate(); // Refrescar el contador en la pantalla principal
        } catch (error) {
            Alert.alert("Error", "No se pudo publicar tu comentario.");
        }
    };

    if (!post) return null;

    const isLiked = user ? post.likes.includes(user.uid) : false;

    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Image source={{ uri: post.image }} style={styles.modalImage} />
                    <ScrollView style={styles.modalScrollView}>
                        <View style={styles.authorHeader}>
                            <Image source={{ uri: post.authorPhoto || 'https://placehold.co/40x40' }} style={styles.authorImage} />
                            <Text style={styles.authorName}>{post.authorName}</Text>
                        </View>
                        <Text style={styles.modalTitle}>{post.title}</Text>
                        {post.description && <Text style={styles.modalText}>{post.description}</Text>}
                        
                        <View style={styles.actionsContainer}>
                            <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
                                <FontAwesome name={isLiked ? "heart" : "heart-o"} size={24} color={isLiked ? Colors.theme.primary : Colors.theme.grey} />
                                <Text style={styles.actionText}>{post.likes.length}</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.separator} />
                        <Text style={styles.modalSubtitle}>Comentarios</Text>
                        {loadingComments ? <ActivityIndicator/> : (
                            comments.length > 0 ? comments.map(comment => (
                                <View key={comment.id} style={styles.commentContainer}>
                                    <Text style={styles.commentAuthor}>{comment.userName}</Text>
                                    <Text style={styles.commentText}>"{comment.text}"</Text>
                                </View>
                            )) : <Text style={styles.emptyText}>Sé el primero en comentar.</Text>
                        )}

                        <View style={styles.addCommentContainer}>
                            <TextInput style={styles.commentInput} placeholder="Añade un comentario..." value={newComment} onChangeText={setNewComment} />
                            <TouchableOpacity style={styles.submitButton} onPress={handleCommentSubmit}>
                                <Text style={styles.submitButtonText}>Publicar</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Cerrar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { height: '90%', backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
    modalImage: { width: '100%', height: '35%' },
    modalScrollView: { paddingHorizontal: 20 },
    authorHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
    authorImage: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
    authorName: { fontWeight: 'bold', fontSize: 16 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
    modalText: { fontSize: 16, lineHeight: 24, color: '#333' },
    actionsContainer: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderTopWidth: 1, borderColor: '#eee', marginTop: 10 },
    actionButton: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
    actionText: { marginLeft: 8, fontSize: 16, color: Colors.theme.grey },
    modalSubtitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 10 },
    commentContainer: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    commentText: { fontStyle: 'italic', color: '#555', marginTop: 4 },
    commentAuthor: { fontSize: 14, color: Colors.theme.text, fontWeight: '600' },
    addCommentContainer: { marginTop: 20, paddingBottom: 40 },
    commentInput: { height: 60, borderColor: '#ddd', borderWidth: 1, borderRadius: 10, padding: 10, textAlignVertical: 'top', marginBottom: 10 },
    submitButton: { backgroundColor: Colors.theme.accent, padding: 12, borderRadius: 10, alignItems: 'center' },
    submitButtonText: { color: 'white', fontWeight: 'bold' },
    closeButton: { backgroundColor: Colors.theme.primary, padding: 15, alignItems: 'center' },
    closeButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    emptyText: { textAlign: 'center', color: Colors.theme.grey, fontStyle: 'italic', paddingVertical: 20 },
    separator: { height: 1, backgroundColor: '#eee', marginVertical: 15 },
});
