import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';

// --- Interfaces ---
interface Duel {
    id: string;
    title: string;
    description: string;
    endDate: { toDate: () => Date };
    isActive: boolean;
    winner?: {
        authorName: string;
        authorPhoto: string;
        title: string;
        image: string;
    };
}
interface Post {
    id: string;
    title: string;
    image: string;
    authorName: string;
    authorPhoto: string;
    likes: string[];
}

interface TimeLeft {
    días?: number;
    horas?: number;
    minutos?: number;
}

// --- Componentes ---
const ParticipantCard = ({ item, rank }: { item: Post, rank?: number }) => {
    const isPodium = rank !== undefined && rank < 3;
    const rankColor = ['#FFD700', '#C0C0C0', '#CD7F32'][rank || 0];

    return (
        <Animated.View entering={FadeInDown.delay(rank ? rank * 100 : 300)} style={[styles.participantCard, isPodium && styles.podiumCard]}>
            {isPodium && (
                <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
                    <Text style={styles.rankText}>{rank! + 1}</Text>
                </View>
            )}
            <Image source={{ uri: item.image }} style={styles.participantImage} />
            <View style={styles.participantInfo}>
                <Text style={styles.participantName} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.authorName} numberOfLines={1}>Por: {item.authorName}</Text>
                <View style={styles.likesContainer}>
                    <FontAwesome name="heart" size={14} color={Colors.theme.primary} />
                    <Text style={styles.likesText}>{item.likes.length}</Text>
                </View>
            </View>
        </Animated.View>
    );
};

const LastWinnerCard = ({ duel }: { duel: Duel }) => (
    <Animated.View entering={FadeInDown} style={styles.lastWinnerCard}>
        <Text style={styles.sectionTitle}>Último Ganador</Text>
        <Image source={{ uri: duel.winner?.image }} style={styles.winnerImage} />
        <View style={styles.winnerInfo}>
            <Image source={{ uri: duel.winner?.authorPhoto }} style={styles.winnerAuthorImage} />
            <View>
                <Text style={styles.winnerPostTitle}>{duel.winner?.title}</Text>
                <Text style={styles.winnerAuthorName}>{duel.winner?.authorName}</Text>
            </View>
        </View>
    </Animated.View>
);

const Countdown = ({ endDate }: { endDate: Date }) => {
    const calculateTimeLeft = (): TimeLeft => {
        const difference = +endDate - +new Date();
        let timeLeft: TimeLeft = {};

        if (difference > 0) {
            timeLeft = {
                días: Math.floor(difference / (1000 * 60 * 60 * 24)),
                horas: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutos: Math.floor((difference / 1000 / 60) % 60),
            };
        }
        return timeLeft;
    };

    const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft());

    useEffect(() => {
        const timer = setTimeout(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);
        return () => clearTimeout(timer);
    });

    const timerComponents = Object.entries(timeLeft).map(([interval, value]) => {
        if (value <= 0 && interval !== 'minutos') return null;
        return (
            <View key={interval} style={styles.timerBlock}>
                <Text style={styles.timerValue}>{value}</Text>
                <Text style={styles.timerLabel}>{interval}</Text>
            </View>
        );
    });

    return (
        <View style={styles.timerContainer}>
            {Object.keys(timeLeft).length ? timerComponents : <Text style={styles.duelEndedText}>¡El duelo ha finalizado!</Text>}
        </View>
    );
};

// --- Pantalla de Duelos ---
export default function DuelsScreen() {
    const router = useRouter();
    const { user, promptLogin } = useAuth();
    const [activeDuel, setActiveDuel] = useState<Duel | null>(null);
    const [lastWinnerDuel, setLastWinnerDuel] = useState<Duel | null>(null);
    const [participants, setParticipants] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const duelsRef = collection(db, "duels");
        const q = query(duelsRef, orderBy("endDate", "desc"));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            setLoading(true);
            const duelsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Duel[];
            
            const currentActiveDuel = duelsData.find(d => d.isActive) || null;
            const lastFinishedDuel = duelsData.find(d => !d.isActive && d.winner) || null;
            
            setActiveDuel(currentActiveDuel);
            setLastWinnerDuel(lastFinishedDuel);

            if (currentActiveDuel) {
                const postsRef = collection(db, "posts");
                const qPosts = query(postsRef, where("duelId", "==", currentActiveDuel.id));
                const postsSnapshot = await getDocs(qPosts);
                const participantsData = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
                participantsData.sort((a, b) => b.likes.length - a.likes.length);
                setParticipants(participantsData);
            } else {
                setParticipants([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleAddPost = () => {
        if (!user) {
            promptLogin();
        } else {
            router.push('/createPost');
        }
    };

    const podium = useMemo(() => participants.slice(0, 3), [participants]);
    const otherParticipants = useMemo(() => participants.slice(3), [participants]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Duelos de Sazón</Text>
            </View>

            {loading ? <ActivityIndicator size="large" color={Colors.theme.primary} style={{ marginTop: 50 }}/> : (
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {lastWinnerDuel && <LastWinnerCard duel={lastWinnerDuel} />}

                    {activeDuel ? (
                        <Animated.View entering={FadeInDown.delay(200)} style={styles.activeDuelSection}>
                            <Text style={styles.sectionTitle}>Duelo Actual</Text>
                            <Text style={styles.duelTitle}>{activeDuel.title}</Text>
                            <Text style={styles.duelDescription}>{activeDuel.description}</Text>
                            <Countdown endDate={activeDuel.endDate.toDate()} />
                            <TouchableOpacity onPress={handleAddPost} style={styles.participateButton}>
                                <Text style={styles.participateButtonText}>¡Participa Ahora!</Text>
                            </TouchableOpacity>

                            {podium.length > 0 && (
                                <>
                                    <Text style={styles.podiumTitle}>Podio Actual</Text>
                                    <View style={styles.podiumContainer}>
                                        {podium.map((item, index) => (
                                            <ParticipantCard key={item.id} item={item} rank={index} />
                                        ))}
                                    </View>
                                </>
                            )}
                            
                            {otherParticipants.length > 0 && <Text style={styles.podiumTitle}>Más Participantes</Text>}
                            <FlatList
                                data={otherParticipants}
                                renderItem={({ item }) => <ParticipantCard item={item} />}
                                keyExtractor={item => item.id}
                                numColumns={2}
                                scrollEnabled={false}
                                columnWrapperStyle={{ justifyContent: 'space-between' }}
                            />
                        </Animated.View>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <FontAwesome name="trophy" size={50} color={Colors.theme.grey} />
                            <Text style={styles.emptyText}>No hay duelos activos en este momento.</Text>
                            <Text style={styles.emptySubText}>¡Vuelve pronto para más acción!</Text>
                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background },
    header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 15, backgroundColor: Colors.theme.card, borderBottomWidth: 1, borderBottomColor: '#eee' },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: Colors.theme.text },
    scrollContent: { padding: 15, paddingBottom: 50 },
    sectionTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.theme.text, marginBottom: 15 },
    
    // Last Winner
    lastWinnerCard: { backgroundColor: Colors.theme.card, borderRadius: 15, padding: 15, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
    winnerImage: { width: '100%', height: 180, borderRadius: 10, marginBottom: 10 },
    winnerInfo: { flexDirection: 'row', alignItems: 'center' },
    winnerAuthorImage: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
    winnerPostTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.theme.text },
    winnerAuthorName: { fontSize: 14, color: Colors.theme.grey },

    // Active Duel
    activeDuelSection: { backgroundColor: Colors.theme.card, borderRadius: 15, padding: 15, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
    duelTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.theme.primary, textAlign: 'center', marginBottom: 5 },
    duelDescription: { fontSize: 15, color: Colors.theme.grey, textAlign: 'center', marginBottom: 20 },
    timerContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
    timerBlock: { alignItems: 'center', marginHorizontal: 10 },
    timerValue: { fontSize: 28, fontWeight: 'bold', color: Colors.theme.text },
    timerLabel: { fontSize: 12, color: Colors.theme.grey, textTransform: 'uppercase' },
    duelEndedText: { fontSize: 18, fontWeight: 'bold', color: Colors.theme.accent },
    participateButton: { backgroundColor: Colors.theme.accent, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, alignSelf: 'center', marginBottom: 20 },
    participateButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

    // Podium & Participants
    podiumTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.theme.text, marginTop: 10, marginBottom: 10 },
    podiumContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', marginBottom: 10 },
    participantCard: { flex: 1/2, margin: 5, backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, maxWidth: '47%' },
    podiumCard: { maxWidth: '31%' },
    participantImage: { width: '100%', height: 120 },
    participantInfo: { padding: 10 },
    participantName: { fontSize: 14, fontWeight: '600', color: Colors.theme.text },
    authorName: { fontSize: 12, color: Colors.theme.grey },
    likesContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
    likesText: { marginLeft: 5, color: Colors.theme.grey, fontWeight: 'bold' },
    rankBadge: { position: 'absolute', top: 5, left: 5, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 1, elevation: 5 },
    rankText: { color: 'white', fontWeight: 'bold' },

    // Empty State
    emptyContainer: { marginTop: 50, alignItems: 'center', padding: 20 },
    emptyText: { fontSize: 18, color: Colors.theme.grey, fontWeight: '600', textAlign: 'center' },
    emptySubText: { fontSize: 14, color: Colors.theme.grey, marginTop: 5, textAlign: 'center' },
});
