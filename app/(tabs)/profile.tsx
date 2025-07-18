import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { deleteObject, getStorage, ref } from 'firebase/storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, SafeAreaView, ScrollView, StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { EditProfileModal } from '../../components/EditProfileModal';
import { FriendsModal } from '../../components/FriendsModal';
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
    duelId?: string;
}
interface Frame { name: string; url: string; }
interface Duel { id: string; title: string; }

// --- Componente para el patrón de fondo ---
const HeaderIconPattern = () => {
    const pattern = useMemo(() => {
        const icons = ['cutlery', 'spoon', 'coffee', 'glass', 'lemon-o', 'star-o', 'heart-o'];
        const generatedPattern = [];
        const numIcons = 40; // Cantidad de íconos en el patrón

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
    }, []); // El array de dependencias vacío asegura que esto se ejecute solo una vez

    return <View style={StyleSheet.absoluteFill}>{pattern}</View>;
};


// --- Componentes ---
const ProfilePostCard = ({ item, onPress, onOpenMenu }: { item: Post, onPress: () => void, onOpenMenu: () => void }) => (
    <TouchableOpacity style={styles.postItem} onPress={onPress} onLongPress={onOpenMenu}>
        <Image source={{ uri: item.image }} style={styles.postImage} />
        <TouchableOpacity style={styles.menuIcon} onPress={onOpenMenu}>
            <FontAwesome name="ellipsis-v" size={20} color="white" />
        </TouchableOpacity>
    </TouchableOpacity>
);

// --- Pantalla de Perfil ---
export default function ProfileScreen() {
    const { user, logout, fetchUserProfile, showAlert } = useAuth();
    const router = useRouter();
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [activeTab, setActiveTab] = useState<'posts' | 'badges' | 'frames'>('posts');
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [selectedPostForMenu, setSelectedPostForMenu] = useState<Post | null>(null);
    const [activeDuel, setActiveDuel] = useState<Duel | null>(null);
    const [hasNewBadges, setHasNewBadges] = useState(false);
    const [hasNewFrames, setHasNewFrames] = useState(false);
    const [isFriendsModalVisible, setIsFriendsModalVisible] = useState(false);
    const [friendsModalInitialTab, setFriendsModalInitialTab] = useState<'following' | 'followers' | 'search'>('search');

    const handleLogout = () => {
        showAlert({
            title: 'Cerrar Sesión',
            message: '¿Estás seguro de que quieres cerrar sesión?',
            buttons: [
                { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
                { text: 'Cerrar Sesión', onPress: logout, style: 'destructive' },
            ]
        });
    };

    const loadProfileData = useCallback(async () => {
        if (!user) { 
            setLoadingPosts(false); 
            return; 
        }
        setLoadingPosts(true);
        try {
            await fetchUserProfile(user.uid);
            const postsRef = collection(db, "posts");
            const qPosts = query(postsRef, where("authorId", "==", user.uid), orderBy("createdAt", "desc"));
            const postsSnapshot = await getDocs(qPosts);
            setUserPosts(postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[]);

            const duelsRef = collection(db, "duels");
            const qDuels = query(duelsRef, where("isActive", "==", true), limit(1));
            const duelSnapshot = await getDocs(qDuels);
            if (!duelSnapshot.empty) {
                const duelDoc = duelSnapshot.docs[0];
                setActiveDuel({ id: duelDoc.id, ...duelDoc.data() } as Duel);
            } else {
                setActiveDuel(null);
            }

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

    const handleOpenMenu = (post: Post) => {
        setSelectedPostForMenu(post);
        setIsMenuVisible(true);
    };

    const handleDeletePost = async () => {
        if (!selectedPostForMenu) return;
        const { id: postId, image: imageUrl } = selectedPostForMenu;
        setIsMenuVisible(false);

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

    const handleLeaveDuel = async () => {
        if (!selectedPostForMenu) return;
        const { id: postId } = selectedPostForMenu;
        setIsMenuVisible(false);

        Alert.alert(
            "Dejar Duelo",
            "¿Seguro que quieres retirar esta publicación del duelo?",
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Sí, retirar", style: "destructive", onPress: async () => {
                    try {
                        const postRef = doc(db, "posts", postId);
                        await updateDoc(postRef, {
                            duelId: null
                        });
                        Alert.alert("Éxito", "La publicación ya no participa en el duelo.");
                        loadProfileData();
                    } catch (error) {
                        console.error("Error leaving duel: ", error);
                        Alert.alert("Error", "No se pudo retirar la publicación del duelo.");
                    }
                }}
            ]
        );
    };

    const handleJoinDuel = async () => {
        if (!selectedPostForMenu || !activeDuel) return;
        const { id: postId } = selectedPostForMenu;
        setIsMenuVisible(false);

        Alert.alert(
            "Unirse al Duelo",
            `¿Quieres que esta publicación participe en el duelo "${activeDuel.title}"?`,
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Sí, unirme", onPress: async () => {
                    try {
                        const postRef = doc(db, "posts", postId);
                        await updateDoc(postRef, {
                            duelId: activeDuel.id
                        });
                        Alert.alert("¡Éxito!", "Tu publicación ahora está participando en el duelo.");
                        loadProfileData();
                    } catch (error) {
                        console.error("Error joining duel: ", error);
                        Alert.alert("Error", "No se pudo unir la publicación al duelo.");
                    }
                }}
            ]
        );
    };
    
    const handleEditPost = () => {
        setIsMenuVisible(false);
        Alert.alert("Editar Publicación", "Esta función se implementará pronto.");
    };

    const openFriendsModal = (tab: 'following' | 'followers' | 'search') => {
        setFriendsModalInitialTab(tab);
        setIsFriendsModalVisible(true);
    };

    if (!user) {
        return <SafeAreaView style={styles.loadingContainer}><Text style={styles.emptyText}>Inicia sesión para ver tu perfil.</Text></SafeAreaView>;
    }
    
    const userTitle = user.badges && user.badges.length > 0 ? user.badges[user.badges.length - 1] : null;

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                ListHeaderComponent={
                    <>
                        <View style={styles.headerShape}>
                            <HeaderIconPattern />
                            <View style={styles.headerContent}>
                                <TouchableOpacity style={styles.headerButton} onPress={handleLogout}>
                                    <FontAwesome name="sign-out" size={24} color={Colors.theme.textLight} />
                                </TouchableOpacity>
                                <ProfilePicture 
                                    photoURL={user.photoURL}
                                    frameURL={user.equippedFrameUrl}
                                    size={screenWidth * 0.3}
                                    borderColor={Colors.theme.background}
                                    borderWidth={4}
                                />
                                <TouchableOpacity style={styles.headerButton} onPress={() => openFriendsModal('search')}>
                                    <FontAwesome name="user-plus" size={24} color={Colors.theme.textLight} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.name}>{user.name} {user.lastName}</Text>
                            <Text style={styles.nickname}>@{user.nickname}</Text>
                            {user.description ? <Text style={styles.description}>{user.description}</Text> : null}
                        </View>

                        <View style={styles.statsContainer}>
                            <View style={styles.stat}><Text style={styles.statNumber}>{userPosts.length}</Text><Text style={styles.statLabel}>Posts</Text></View>
                            <TouchableOpacity style={styles.stat} onPress={() => openFriendsModal('followers')}>
                                <Text style={styles.statNumber}>{user.followersCount || 0}</Text>
                                <Text style={styles.statLabel}>Seguidores</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.stat} onPress={() => openFriendsModal('following')}>
                                <Text style={styles.statNumber}>{user.followingCount || 0}</Text>
                                <Text style={styles.statLabel}>Siguiendo</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <TouchableOpacity style={styles.editButton} onPress={() => setIsEditModalVisible(true)}>
                            <Text style={styles.editButtonText}>Editar Perfil</Text>
                        </TouchableOpacity>

                        <View style={styles.tabContainer}>
                            <TouchableOpacity onPress={() => handleTabChange('posts')} style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}>
                                <FontAwesome name="th" size={20} color={activeTab === 'posts' ? Colors.theme.secondary : Colors.theme.grey} />
                                <Text style={[styles.tabText, activeTab === 'posts' && {color: Colors.theme.secondary}]}>Posts</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleTabChange('badges')} style={[styles.tabButton, activeTab === 'badges' && styles.tabButtonActive]}>
                                <View>
                                    <FontAwesome name="trophy" size={20} color={activeTab === 'badges' ? Colors.theme.secondary : Colors.theme.grey} />
                                    {hasNewBadges && <View style={styles.newIndicator} />}
                                </View>
                                <Text style={[styles.tabText, activeTab === 'badges' && {color: Colors.theme.secondary}]}>Insignias</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleTabChange('frames')} style={[styles.tabButton, activeTab === 'frames' && styles.tabButtonActive]}>
                                <View>
                                    <FontAwesome name="image" size={20} color={activeTab === 'frames' ? Colors.theme.secondary : Colors.theme.grey} />
                                    {hasNewFrames && <View style={styles.newIndicator} />}
                                </View>
                                <Text style={[styles.tabText, activeTab === 'frames' && {color: Colors.theme.secondary}]}>Marcos</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                }
                data={activeTab === 'posts' ? userPosts : []}
                numColumns={3}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <ProfilePostCard item={item} onPress={() => setSelectedPost(item)} onOpenMenu={() => handleOpenMenu(item)} />}
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
                                <Text style={styles.sectionTitle}>Mis Marcos</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.framesScrollView}>
                                    {(user.frames && user.frames.length > 0) ? user.frames.map((frame, index) => (
                                        <TouchableOpacity key={index} style={[styles.frameItem, user.equippedFrameUrl === frame.url && styles.frameItemSelected]} onPress={() => handleEquipFrame(frame.url)}>
                                            <Image source={{ uri: frame.url }} style={styles.framePreview} />
                                        </TouchableOpacity>
                                    )) : <View style={styles.emptyContainer}><Text style={styles.emptyText}>Aún no has ganado marcos.</Text></View>}
                                </ScrollView>
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
            <FriendsModal 
                visible={isFriendsModalVisible}
                onClose={() => setIsFriendsModalVisible(false)}
                initialTab={friendsModalInitialTab}
            />
            <Modal
                transparent={true}
                visible={isMenuVisible}
                animationType="fade"
                onRequestClose={() => setIsMenuVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setIsMenuVisible(false)}>
                    <View style={styles.menuOverlay}>
                        <View style={styles.menuContainer}>
                            <TouchableOpacity style={styles.menuOption} onPress={handleEditPost}>
                                <FontAwesome name="pencil" size={20} color={Colors.theme.text} />
                                <Text style={styles.menuOptionText}>Editar Publicación</Text>
                            </TouchableOpacity>
                            {selectedPostForMenu?.duelId ? (
                                <TouchableOpacity style={styles.menuOption} onPress={handleLeaveDuel}>
                                    <FontAwesome name="trophy" size={20} color={Colors.theme.text} />
                                    <Text style={styles.menuOptionText}>Dejar de participar en el duelo</Text>
                                </TouchableOpacity>
                            ) : activeDuel && (
                                <TouchableOpacity style={styles.menuOption} onPress={handleJoinDuel}>
                                    <FontAwesome name="trophy" size={20} color={Colors.theme.accent} />
                                    <Text style={[styles.menuOptionText, { color: Colors.theme.accent }]}>Participar en el duelo</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={[styles.menuOption, { borderBottomWidth: 0 }]} onPress={handleDeletePost}>
                                <FontAwesome name="trash" size={20} color={Colors.theme.primary} />
                                <Text style={[styles.menuOptionText, { color: Colors.theme.primary }]}>Eliminar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
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
    editButton: {
        alignSelf: 'center',
        marginTop: 20,
        backgroundColor: Colors.theme.secondary,
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 30,
        elevation: 5,
        shadowColor: Colors.theme.secondary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    editButtonText: {
        color: Colors.theme.textLight,
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
    newIndicator: { position: 'absolute', top: -2, right: -8, width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.theme.primary, borderWidth: 1.5, borderColor: Colors.theme.card },
    postItem: { width: (screenWidth / 3), height: (screenWidth / 3), position: 'relative' },
    postImage: { width: '100%', height: '100%' },
    menuIcon: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 15 },
    emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    emptyText: { fontSize: 16, color: Colors.theme.grey, textAlign: 'center' },
    itemsSection: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    badgeItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.theme.card, padding: 15, borderRadius: 10, marginBottom: 10, elevation: 2 },
    badgeEmoji: { fontSize: 30, marginRight: 15 },
    badgeText: { fontSize: 16, fontWeight: '600', color: Colors.theme.text },
    framesScrollView: { paddingVertical: 10 },
    frameItem: { 
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: 'transparent',
    },
    frameItemSelected: {
        borderColor: Colors.theme.accent,
    },
    framePreview: { 
        width: 90, 
        height: 90, 
        resizeMode: 'contain',
    },
    fab: { position: 'absolute', width: 56, height: 56, alignItems: 'center', justifyContent: 'center', right: 20, bottom: 20, backgroundColor: Colors.theme.primary, borderRadius: 28, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    menuContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 10,
    },
    menuOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    menuOptionText: {
        marginLeft: 15,
        fontSize: 16,
        color: Colors.theme.text,
    },
    titleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 15,
        paddingHorizontal: 12,
        paddingVertical: 5,
        marginTop: 8,
    },
    userTitle: {
        marginLeft: 6,
        fontSize: 15,
        fontWeight: '600',
        color: 'white',
    },
});
