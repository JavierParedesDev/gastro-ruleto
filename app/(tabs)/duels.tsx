import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ProfilePicture from '../../components/ProfilePicture';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';

// --- Interfaces (sin cambios) ---
interface Prize {
    type: 'badge' | 'frame';
    value: string;
}

interface Duel {
    id: string;
    title: string;
    description: string;
    endDate: { toDate: () => Date };
    isActive: boolean;
    winner?: {
        authorId: string;
        authorName: string;
        authorPhoto: string;
        title: string;
        image: string;
    };
    prize?: Prize;
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


// --- Componentes (con un nuevo componente para la lista de participantes) ---
const ParticipantRow = ({ item }: { item: Post }) => (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.participantRow}>
        <Image source={{ uri: item.image }} style={styles.participantRowImage} />
        <View style={styles.participantRowInfo}>
            <Text style={styles.participantRowName} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.participantRowAuthor} numberOfLines={1}>Por: {item.authorName}</Text>
        </View>
        <View style={styles.likesContainer}>
            <FontAwesome name="heart" size={14} color={Colors.theme.primary} />
            <Text style={styles.likesText}>{item.likes.length}</Text>
        </View>
    </Animated.View>
);

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
        <Image source={{ uri: duel.winner?.image }} style={styles.winnerImage} />
        <View style={styles.winnerInfo}>
            <ProfilePicture photoURL={duel.winner?.authorPhoto} size={40} />
            <View>
                <Text style={styles.winnerPostTitle}>{duel.winner?.title}</Text>
                <Text style={styles.winnerAuthorName}>Por: {duel.winner?.authorName}</Text>
            </View>
        </View>
        {duel.prize && (
            <View style={styles.prizeSection}>
                <Text style={styles.prizeTitle}>Premio Obtenido</Text>
                <View style={styles.prizeContainer}>
                    {duel.prize.type === 'badge' ? (
                        <>
                            <FontAwesome name="shield" size={20} color={Colors.theme.accent} />
                            <Text style={styles.prizeValue}>{duel.prize.value}</Text>
                        </>
                    ) : (
                        <>
                            <FontAwesome name="image" size={20} color={Colors.theme.accent} />
                            <Text style={styles.prizeValue}>Marco de Perfil</Text>
                            <Image source={{ uri: duel.prize.value }} style={styles.framePreview} />
                        </>
                    )}
                </View>
            </View>
        )}
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
        if (value <= 0 && interval !== 'minutos' && interval !== 'horas' && interval !== 'días') return null;
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


// --- Pantalla de Duelos (Componente Principal) ---
export default function DuelsScreen() {
    const router = useRouter();
    const { user, promptLogin } = useAuth();
    const [activeDuel, setActiveDuel] = useState<Duel | null>(null);
    const [lastWinnerDuel, setLastWinnerDuel] = useState<Duel | null>(null);
    const [participants, setParticipants] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'current' | 'participants' | 'winner'>('current');
    const [searchQuery, setSearchQuery] = useState(''); 

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

    const filteredParticipants = useMemo(() => {
        if (!searchQuery) {
            return otherParticipants;
        }
        return participants.filter(participant =>
            participant.authorName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [participants, searchQuery, otherParticipants]);

    const renderContent = () => {
        if (loading) {
            return <ActivityIndicator size="large" color={Colors.theme.primary} style={{ marginTop: 50 }} />;
        }

        if (activeTab === 'current') {
            return activeDuel ? (
                <Animated.View entering={FadeInDown.delay(200)} style={styles.activeDuelSection}>
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
                </Animated.View>
            ) : (
                <View style={styles.emptyContainer}>
                    <FontAwesome name="trophy" size={50} color={Colors.theme.grey} />
                    <Text style={styles.emptyText}>No hay duelos activos.</Text>
                </View>
            );
        }
        
        if (activeTab === 'participants') {
            return (
                <View>
                    <View style={styles.searchContainer}>
                        <FontAwesome name="search" size={18} color={Colors.theme.grey} style={{ marginRight: 10 }} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar participante..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    <FlatList
                        data={filteredParticipants}
                        renderItem={({ item }) => <ParticipantRow item={item} />}
                        keyExtractor={item => item.id}
                        scrollEnabled={false}
                        ListEmptyComponent={<Text style={styles.emptyText}>No se encontraron participantes.</Text>}
                    />
                </View>
            );
        }

        if (activeTab === 'winner') {
            return lastWinnerDuel ? (
                <LastWinnerCard duel={lastWinnerDuel} />
            ) : (
                <View style={styles.emptyContainer}>
                    <FontAwesome name="star-o" size={50} color={Colors.theme.grey} />
                    <Text style={styles.emptyText}>Aún no hay ganadores anteriores.</Text>
                </View>
            );
        }

        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Duelos de Sazón</Text>
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity onPress={() => setActiveTab('current')} style={[styles.tabButton, activeTab === 'current' && styles.tabButtonActive]}>
                    <Text style={[styles.tabText, activeTab === 'current' && styles.tabTextActive]}>Duelo Actual</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('participants')} style={[styles.tabButton, activeTab === 'participants' && styles.tabButtonActive]}>
                    <Text style={[styles.tabText, activeTab === 'participants' && styles.tabTextActive]}>Participantes</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('winner')} style={[styles.tabButton, activeTab === 'winner' && styles.tabButtonActive]} disabled={!lastWinnerDuel}>
                    <Text style={[styles.tabText, activeTab === 'winner' && styles.tabTextActive, !lastWinnerDuel && styles.tabTextDisabled]}>Último Ganador</Text>
                </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {renderContent()}
            </ScrollView>
        </View>
    );
}

// --- Estilos ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.theme.background },
    header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 15, backgroundColor: Colors.theme.card, borderBottomWidth: 1, borderBottomColor: '#eee' },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: Colors.theme.text },
    scrollContent: { padding: 15, paddingBottom: 50 },

    // Estilos para el Tab Switcher
    tabContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginHorizontal: 15,
        marginTop: 15,
        backgroundColor: Colors.theme.card,
        borderRadius: 10,
        elevation: 2,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5
    },
    tabButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
    },
    tabButtonActive: {
        backgroundColor: Colors.theme.primary,
    },
    tabText: {
        color: Colors.theme.primary,
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 12,
    },
    tabTextActive: {
        color: Colors.theme.textLight,
    },
    tabTextDisabled: {
        color: '#ccc'
    },
    
    // Estilos de la tarjeta de ganador
    lastWinnerCard: { backgroundColor: Colors.theme.card, borderRadius: 15, padding: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
    winnerImage: { width: '100%', height: 180, borderRadius: 10, marginBottom: 10 },
    winnerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    winnerPostTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.theme.text, flexShrink: 1, marginLeft: 10 },
    winnerAuthorName: { fontSize: 14, color: Colors.theme.grey, marginLeft: 10 },
    prizeSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    prizeTitle: { fontSize: 14, fontWeight: 'bold', color: Colors.theme.grey, marginBottom: 5 },
    prizeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
    prizeValue: { marginLeft: 8, fontSize: 16, fontWeight: '600', color: Colors.theme.accent },
    framePreview: { width: 30, height: 30, marginLeft: 10, resizeMode: 'contain' },
    
    // Estilos del duelo actual
    activeDuelSection: { backgroundColor: Colors.theme.card, borderRadius: 15, padding: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
    duelTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.theme.primary, textAlign: 'center', marginBottom: 5 },
    duelDescription: { fontSize: 15, color: Colors.theme.grey, textAlign: 'center', marginBottom: 20 },
    timerContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
    timerBlock: { alignItems: 'center', marginHorizontal: 10 },
    timerValue: { fontSize: 28, fontWeight: 'bold', color: Colors.theme.text },
    timerLabel: { fontSize: 12, color: Colors.theme.grey, textTransform: 'uppercase' },
    duelEndedText: { fontSize: 18, fontWeight: 'bold', color: Colors.theme.accent },
    participateButton: { backgroundColor: Colors.theme.accent, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, alignSelf: 'center', marginBottom: 20 },
    participateButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

    // Estilos del podio y participantes
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
    
    // **NUEVO** Estilos para la lista y buscador de participantes
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.theme.card,
        borderRadius: 15, 
        marginBottom: 20, 
        paddingHorizontal: 15,
        elevation: 2,
        shadowColor: Colors.theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    searchInput: {
        flex: 1,
        height: 50,
        fontSize: 16,
        color: Colors.theme.text,
    },
    participantRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.theme.card,
        padding: 10,
        borderRadius: 10,
        marginBottom: 10,
        elevation: 2
    },
    participantRowImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
        marginRight: 10
    },
    participantRowInfo: {
        flex: 1
    },
    participantRowName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.theme.text
    },
    participantRowAuthor: {
        fontSize: 14,
        color: Colors.theme.grey
    },

    // Estado vacío
    emptyContainer: { marginTop: 50, alignItems: 'center', padding: 20 },
    emptyText: { fontSize: 18, color: Colors.theme.grey, fontWeight: '600', textAlign: 'center' },
    emptySubText: { fontSize: 14, color: Colors.theme.grey, marginTop: 5, textAlign: 'center' },
});