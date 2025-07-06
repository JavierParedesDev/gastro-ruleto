import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';

// --- Interfaces ---
interface Duel {
    id: string;
    title: string;
    description: string;
    endDate: any;
    isActive: boolean;
}
interface Post {
    id: string;
    title: string;
    image: string;
    authorName: string;
    likes: string[];
}

// --- Componente de Tarjeta de Participante ---
const ParticipantCard = ({ item }: { item: Post }) => (
    <View style={styles.participantCard}>
        <Image source={{ uri: item.image }} style={styles.participantImage} />
        <Text style={styles.participantName} numberOfLines={1}>{item.title}</Text>
        <View style={styles.likesContainer}>
            <FontAwesome name="heart" size={14} color={Colors.theme.primary} />
            <Text style={styles.likesText}>{item.likes.length}</Text>
        </View>
    </View>
);

// --- Pantalla de Duelos ---
export default function DuelsScreen() {
    const router = useRouter();
    const { user, promptLogin } = useAuth();
    const [activeDuel, setActiveDuel] = useState<Duel | null>(null);
    const [participants, setParticipants] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Buscar el duelo activo
            const duelsRef = collection(db, "duels");
            const qDuels = query(duelsRef, where("isActive", "==", true));
            const duelSnapshot = await getDocs(qDuels);

            if (!duelSnapshot.empty) {
                const duelData = { id: duelSnapshot.docs[0].id, ...duelSnapshot.docs[0].data() } as Duel;
                setActiveDuel(duelData);

                // 2. Buscar los participantes de ese duelo
                const postsRef = collection(db, "posts");
                const qPosts = query(postsRef, where("duelId", "==", duelData.id), orderBy("createdAt", "desc"));
                const postsSnapshot = await getDocs(qPosts);
                const participantsData = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
                setParticipants(participantsData);
            }
        } catch (e) {
            console.error("Failed to load duel data.", e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchData(); }, []));

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
                <Text style={styles.headerTitle}>Duelos de Sazón</Text>
            </View>

            {loading ? <ActivityIndicator size="large" color={Colors.theme.primary} /> : (
                activeDuel ? (
                    <FlatList
                        ListHeaderComponent={
                            <View style={styles.duelInfoContainer}>
                                <Text style={styles.duelTitle}>{activeDuel.title}</Text>
                                <Text style={styles.duelDescription}>{activeDuel.description}</Text>
                                <TouchableOpacity onPress={handleAddPost} style={styles.participateButton}>
                                    <Text style={styles.participateButtonText}>¡Quiero Participar!</Text>
                                </TouchableOpacity>
                                <Text style={styles.participantsTitle}>Participantes</Text>
                            </View>
                        }
                        data={participants}
                        renderItem={({ item }) => <ParticipantCard item={item} />}
                        keyExtractor={item => item.id}
                        numColumns={2}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={<Text style={styles.emptyText}>¡Sé el primero en participar en este duelo!</Text>}
                    />
                ) : (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No hay duelos activos esta semana. ¡Vuelve pronto!</Text>
                    </View>
                )
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background },
    header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 10, backgroundColor: Colors.theme.card, borderBottomWidth: 1, borderBottomColor: '#eee' },
    headerTitle: { fontSize: 32, fontWeight: 'bold', color: Colors.theme.text },
    duelInfoContainer: { padding: 20, alignItems: 'center' },
    duelTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.theme.primary, textAlign: 'center' },
    duelDescription: { fontSize: 16, color: Colors.theme.grey, textAlign: 'center', marginTop: 5, marginBottom: 20 },
    participateButton: { backgroundColor: Colors.theme.accent, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, marginBottom: 20 },
    participateButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    participantsTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.theme.text, alignSelf: 'flex-start' },
    listContent: { paddingHorizontal: 10 },
    participantCard: { flex: 1/2, margin: 5, backgroundColor: Colors.theme.card, borderRadius: 10, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
    participantImage: { width: '100%', height: 150 },
    participantName: { padding: 8, fontWeight: '600', color: Colors.theme.text },
    likesContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8 },
    likesText: { marginLeft: 5, color: Colors.theme.grey },
    emptyContainer: { marginTop: 50, alignItems: 'center' },
    emptyText: { fontSize: 16, color: Colors.theme.grey, textAlign: 'center' },
});
