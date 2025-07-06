import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { addDoc, collection, doc, GeoPoint, getDocs, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'; // Importar updateDoc y arrayUnion
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import MapView, { LongPressEvent, Marker } from 'react-native-maps';
import { Colors } from '../constants/Colors'; // Asegúrate de que esta ruta sea correcta
import { useAuth } from '../context/AuthContext'; // Asegúrate de que esta ruta sea correcta
import { db } from '../firebaseConfig'; // Asegúrate de que esta ruta sea correcta

// --- Interfaces ---
interface Place {
    id: string;
    name: string;
    avgRating?: number;
    image?: string;
    category: string;
    description: string;
    location: GeoPoint;
    ratingCount?: number; // Añadir para contar las calificaciones
}

interface NewPlaceData {
    name: string;
    description: string;
    category: string;
    rating: number;
    imageUri?: string | null;
}

interface NewPlaceCoords {
    latitude: number;
    longitude: number;
}

interface Comment {
    id: string;
    userId: string;
    userName: string;
    userPhoto: string;
    text: string;
    createdAt: any; // Firebase Timestamp
    rating: number;
}

// --- Componente Modal para Añadir un Nuevo Lugar (con paso de reglas) ---
const AddPlaceModal = ({ visible, onClose, onSave }: { visible: boolean, onClose: () => void, onSave: (data: NewPlaceData) => void }) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('Picada');
    const [rating, setRating] = useState(0);
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const categories = ['Picada', 'Feria', 'Amasandería', 'Restaurante', 'Cafetería', 'Otro'];

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
        });

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
        }
    };

    const handleSave = () => {
        if (!name || !description || rating === 0) {
            Alert.alert("Campos incompletos", "Por favor, completa el nombre, descripción y tu calificación.");
            return;
        }
        setIsUploading(true);
        onSave({ name, description, category, rating, imageUri });
    };

    useEffect(() => {
        if (!visible) {
            setTimeout(() => {
                setStep(1);
                setName('');
                setDescription('');
                setCategory('Picada');
                setRating(0);
                setImageUri(null);
                setIsUploading(false);
            }, 300);
        }
    }, [visible]);

    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPressOut={onClose}>
                <TouchableWithoutFeedback>
                    <View style={styles.modalContainer}>
                        {step === 1 ? (
                            <View>
                                <Text style={styles.modalTitle}>¡Comparte un Buen Dato!</Text>
                                <Text style={styles.ruleText}>Para que tu sugerencia sea aprobada, por favor considera:</Text>
                                <View style={styles.ruleItem}><FontAwesome name="check" size={20} color={Colors.theme.accent} /><Text style={styles.ruleItemText}>Asegúrate que el lugar no exista ya en el mapa.</Text></View>
                                <View style={styles.ruleItem}><FontAwesome name="check" size={20} color={Colors.theme.accent} /><Text style={styles.ruleItemText}>Usa nombres y descripciones claras y respetuosas.</Text></View>
                                <View style={styles.ruleItem}><FontAwesome name="check" size={20} color={Colors.theme.accent} /><Text style={styles.ruleItemText}>No incluyas spam ni contenido ofensivo.</Text></View>
                                <TouchableOpacity style={styles.saveButton} onPress={() => setStep(2)}><Text style={styles.saveButtonText}>Entendido, ¡a compartir!</Text></TouchableOpacity>
                            </View>
                        ) : (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text style={styles.modalTitle}>Completa la Información</Text>
                                <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                                    {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImage} /> : (<View style={{ alignItems: 'center' }}><FontAwesome name="camera" size={24} color={Colors.theme.primary} /><Text style={styles.imagePickerText}>Añadir Foto</Text></View>)}
                                </TouchableOpacity>
                                <TextInput style={styles.input} placeholder="Nombre del lugar" value={name} onChangeText={setName} />
                                <TextInput style={styles.input} placeholder="¿Qué lo hace especial? (ej. 'El mejor pan amasado')" value={description} onChangeText={setDescription} />

                                <Text style={styles.inputLabel}>Categoría</Text>
                                <TouchableOpacity style={styles.pickerButton} onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
                                    <Text style={styles.pickerButtonText}>{category}</Text>
                                    <FontAwesome name={showCategoryPicker ? "chevron-up" : "chevron-down"} size={16} color={Colors.theme.grey} />
                                </TouchableOpacity>

                                {showCategoryPicker && (
                                    <View style={styles.pickerOptionsContainer}>
                                        {categories.map(cat => (
                                            <TouchableOpacity key={cat} style={styles.pickerOption} onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}>
                                                <Text style={styles.pickerOptionText}>{cat}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                <Text style={styles.ratingLabel}>Tu Calificación:</Text>
                                <View style={styles.starInputContainer}>
                                    {[1, 2, 3, 4, 5].map(star => (<TouchableOpacity key={star} onPress={() => setRating(star)}><FontAwesome name={star <= rating ? "star" : "star-o"} size={35} color="#FFC107" /></TouchableOpacity>))}
                                </View>
                                <TouchableOpacity style={[styles.saveButton, isUploading && { backgroundColor: Colors.theme.grey }]} onPress={handleSave} disabled={isUploading}>
                                    {isUploading ? <ActivityIndicator color="white" /> : <Text style={styles.saveButtonText}>Enviar Sugerencia</Text>}
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </TouchableWithoutFeedback>
            </TouchableOpacity>
        </Modal>
    );
};

// --- NUEVO Componente Modal para Detalles del Lugar ---
const PlaceDetailModal = ({ visible, onClose, place, onCommentAdded }: { visible: boolean, onClose: () => void, place: Place | null, onCommentAdded: () => void }) => {
    const { user, promptLogin } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newCommentText, setNewCommentText] = useState('');
    const [newCommentRating, setNewCommentRating] = useState(0);
    const [loadingComments, setLoadingComments] = useState(false);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    useEffect(() => {
        if (visible && place) {
            fetchComments();
        } else {
            setComments([]); // Clear comments when modal closes
            setNewCommentText('');
            setNewCommentRating(0);
        }
    }, [visible, place]);

    const fetchComments = async () => {
        if (!place) return;
        setLoadingComments(true);
        try {
            const commentsRef = collection(db, `places/${place.id}/comments`);
            const querySnapshot = await getDocs(commentsRef);
            const commentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Comment[];
            // Sort comments by creation date (newest first)
            commentsData.sort((a, b) => {
                if (a.createdAt && b.createdAt) {
                    return b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime();
                }
                return 0;
            });
            setComments(commentsData);
        } catch (error) {
            console.error("Error fetching comments:", error);
            Alert.alert("Error", "No se pudieron cargar los comentarios.");
        } finally {
            setLoadingComments(false);
        }
    };

    const handleAddComment = async () => {
        if (!user) {
            promptLogin();
            return;
        }
        if (!place) return;
        if (!newCommentText.trim() && newCommentRating === 0) {
            Alert.alert("Comentario vacío", "Por favor, escribe un comentario o deja una calificación.");
            return;
        }

        setIsSubmittingComment(true);
        try {
            const commentData = {
                userId: user.uid,
                userName: `${user.name} ${user.lastName}`,
                userPhoto: user.photoURL || '',
                text: newCommentText.trim(),
                rating: newCommentRating,
                createdAt: serverTimestamp(),
            };
            await addDoc(collection(db, `places/${place.id}/comments`), commentData);

            // Recalcular el rating promedio del lugar
            const placeRef = doc(db, 'places', place.id);
            const currentAvgRating = place.avgRating || 0;
            const currentRatingCount = place.ratingCount || 0;
            const newRatingCount = currentRatingCount + 1;
            const newAvgRating = ((currentAvgRating * currentRatingCount) + newCommentRating) / newRatingCount;

            await updateDoc(placeRef, {
                avgRating: newAvgRating,
                ratingCount: newRatingCount,
            });

            Alert.alert("¡Gracias!", "Tu comentario y calificación han sido añadidos.");
            setNewCommentText('');
            setNewCommentRating(0);
            await fetchComments(); // Refetch comments to show the new one
            onCommentAdded(); // Notify parent to refresh places list in case avgRating needs updating
        } catch (error) {
            console.error("Error al añadir comentario:", error);
            Alert.alert("Error", "No se pudo añadir el comentario. Intenta de nuevo.");
        } finally {
            setIsSubmittingComment(false);
        }
    };

    if (!place) return null;

    const displayRating = place.avgRating ? place.avgRating.toFixed(1) : 'N/A';
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        stars.push(
            <FontAwesome
                key={i}
                name={i <= Math.round(place.avgRating || 0) ? "star" : "star-o"}
                size={20}
                color="#FFC107"
                style={{ marginRight: 2 }}
            />
        );
    }

    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPressOut={onClose}>
                <TouchableWithoutFeedback>
                    <View style={styles.modalContainer}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalTitle}>{place.name}</Text>
                            {place.image && <Image source={{ uri: place.image }} style={styles.detailImage} />}
                            <Text style={styles.detailDescription}>{place.description}</Text>
                            <Text style={styles.detailCategory}>Categoría: {place.category}</Text>

                            <View style={styles.detailRatingContainer}>
                                <Text style={styles.detailRatingText}>Calificación promedio: {displayRating}</Text>
                                <View style={styles.starDisplayContainer}>{stars}</View>
                                {place.ratingCount && place.ratingCount > 0 && (
                                    <Text style={styles.ratingCountText}>({place.ratingCount} {place.ratingCount === 1 ? 'calificación' : 'calificaciones'})</Text>
                                )}
                            </View>

                            <View style={styles.sectionDivider} />

                            <Text style={styles.sectionTitle}>Añadir un comentario y calificación</Text>
                            {user ? (
                                <>
                                    <TextInput
                                        style={styles.commentInput}
                                        placeholder="Escribe tu comentario aquí..."
                                        multiline
                                        value={newCommentText}
                                        onChangeText={setNewCommentText}
                                    />
                                    <View style={styles.starInputContainer}>
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <TouchableOpacity key={star} onPress={() => setNewCommentRating(star)}>
                                                <FontAwesome name={star <= newCommentRating ? "star" : "star-o"} size={30} color="#FFC107" />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.saveButton, isSubmittingComment && { backgroundColor: Colors.theme.grey }]}
                                        onPress={handleAddComment}
                                        disabled={isSubmittingComment}
                                    >
                                        {isSubmittingComment ? <ActivityIndicator color="white" /> : <Text style={styles.saveButtonText}>Publicar</Text>}
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity onPress={promptLogin}>
                                    <Text style={styles.loginToCommentText}>Inicia sesión para comentar y calificar.</Text>
                                </TouchableOpacity>
                            )}

                            <View style={styles.sectionDivider} />

                            <Text style={styles.sectionTitle}>Comentarios ({comments.length})</Text>
                            {loadingComments ? (
                                <ActivityIndicator size="small" color={Colors.theme.primary} style={{ marginTop: 20 }} />
                            ) : comments.length === 0 ? (
                                <Text style={styles.commentText}>Aún no hay comentarios para este lugar. ¡Sé el primero!</Text>
                            ) : (
                                comments.map(comment => (
                                    <View key={comment.id} style={styles.commentContainer}>
                                        <View style={styles.commentHeader}>
                                            <Image
                                                source={{ uri: comment.userPhoto || 'https://via.placeholder.com/40' }} // Placeholder for user photo
                                                style={styles.commentUserPhoto}
                                            />
                                            <View>
                                                <Text style={styles.commentUserName}>{comment.userName}</Text>
                                                <View style={styles.commentStars}>
                                                    {[1, 2, 3, 4, 5].map(star => (
                                                        <FontAwesome
                                                            key={star}
                                                            name={star <= comment.rating ? "star" : "star-o"}
                                                            size={14}
                                                            color="#FFC107"
                                                        />
                                                    ))}
                                                </View>
                                            </View>
                                            {comment.createdAt && <Text style={styles.commentDate}>{comment.createdAt.toDate().toLocaleDateString('es-CL')}</Text>}
                                        </View>
                                        {comment.text.trim() !== '' && (
                                            <Text style={styles.commentText}>{comment.text}</Text>
                                        )}
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </TouchableWithoutFeedback>
            </TouchableOpacity>
        </Modal>
    );
};


// --- Componente de la Pantalla del Mapa ---
export default function MapScreen() {
    const { user, promptLogin } = useAuth();
    const [places, setPlaces] = useState<Place[]>([]);
    const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isAddModalVisible, setAddModalVisible] = useState(false); // Renamed for clarity
    const [isDetailModalVisible, setDetailModalVisible] = useState(false); // New state for detail modal
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null); // State for selected place
    const [newPlaceCoords, setNewPlaceCoords] = useState<NewPlaceCoords | null>(null);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        const setupMap = async () => {
            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setErrorMsg('Permiso de ubicación denegado.');
                    setLoading(false);
                    return;
                }

                let location = await Location.getCurrentPositionAsync({});
                setUserLocation(location);

                // Escucha en tiempo real la colección "places"
                unsubscribe = onSnapshot(collection(db, "places"), (querySnapshot) => {
                    const placesData = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                    })) as Place[];
                    setPlaces(placesData);
                });
            } catch (error) {
                console.error("Error al configurar el mapa:", error);
                setErrorMsg('No se pudo cargar la información. Asegúrate de tener los servicios de ubicación activados.');
            } finally {
                setLoading(false);
            }
        };

        setupMap();
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []);

    const fetchPlaces = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "places"));
            const placesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Place[];
            setPlaces(placesData);
        } catch (error) {
            console.error("Error fetching places:", error);
            setErrorMsg("Error al cargar los lugares del mapa.");
        }
    };

    const handleMapLongPress = (event: LongPressEvent) => {
        if (!user) { promptLogin(); return; }
        setNewPlaceCoords(event.nativeEvent.coordinate);
        setAddModalVisible(true);
    };

    const handleAddAtCurrentLocation = () => {
        if (!user) { promptLogin(); return; }
        if (userLocation) {
            setNewPlaceCoords(userLocation.coords);
            setAddModalVisible(true);
        } else {
            Alert.alert("Ubicación no disponible", "No hemos podido obtener tu ubicación actual.");
        }
    };

    const handleSavePlace = async (placeData: NewPlaceData) => {
        if (!newPlaceCoords || !user) return;

        let imageUrl = '';
        if (placeData.imageUri) {
            try {
                const response = await fetch(placeData.imageUri);
                const blob = await response.blob();
                const storage = getStorage();
                const storageRef = ref(storage, `places_suggestions/${user.uid}_${Date.now()}.jpg`);
                await uploadBytes(storageRef, blob);
                imageUrl = await getDownloadURL(storageRef);
            } catch (error) {
                console.error("Error al subir la imagen:", error);
                Alert.alert("Error", "No se pudo subir la imagen del lugar.");
                setAddModalVisible(false); // Close add modal on upload error
                return;
            }
        }

        try {
            const newSubmission = {
                name: placeData.name,
                description: placeData.description,
                category: placeData.category,
                location: new GeoPoint(newPlaceCoords.latitude, newPlaceCoords.longitude),
                status: 'pending',
                submittedBy: user.uid,
                submittedByName: user.name && user.lastName ? `${user.name} ${user.lastName}` : user.email || 'Usuario Anónimo', // Fallback for name
                submittedByUserPhoto: user.photoURL || '',
                createdAt: serverTimestamp(),
                initialRating: placeData.rating,
                imageUrl: imageUrl,
            };
            await addDoc(collection(db, "place_submissions"), newSubmission);

            Alert.alert("¡Gracias por tu aporte!", "Tu sugerencia ha sido enviada y será revisada pronto.");
            setAddModalVisible(false);
            setNewPlaceCoords(null);
        } catch (error) {
            console.error("Error al enviar la sugerencia:", error);
            Alert.alert("Error", "No se pudo enviar tu sugerencia.");
        }
    };

    const handleMarkerPress = (place: Place) => {
        setSelectedPlace(place);
        setDetailModalVisible(true);
    };

    if (loading) {
        return <View style={styles.loaderContainer}><ActivityIndicator size="large" color={Colors.theme.primary} /></View>;
    }

    if (errorMsg) {
        return <View style={styles.loaderContainer}><Text style={styles.errorText}>{errorMsg}</Text></View>;
    }

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <MapView
                style={styles.map}
                initialRegion={{
                    latitude: userLocation?.coords.latitude || 0,
                    longitude: userLocation?.coords.longitude || 0,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                }}
                showsUserLocation={true}
                showsPointsOfInterest={false}
                onLongPress={handleMapLongPress}
            >
                {places.map(place => (
                    <Marker
                        key={place.id}
                        coordinate={{
                            latitude: place.location.latitude,
                            longitude: place.location.longitude,
                        }}
                        pinColor={Colors.theme.primary}
                        onPress={() => handleMarkerPress(place)} // Handle press to show detail modal
                    >
                        {/* Remove Callout if you are using a custom modal for details */}
                        {/* <Callout>
                            <View style={styles.calloutView}>
                                <Text style={styles.calloutTitle}>{place.name}</Text>
                                <Text style={styles.calloutDescription}>{place.description}</Text>
                                <Text style={styles.calloutCategory}>{place.category}</Text>
                            </View>
                        </Callout> */}
                    </Marker>
                ))}
            </MapView>

            <View style={styles.infoBox}>
                <Text style={styles.infoText}>Mantén presionado el mapa para añadir una picada</Text>
            </View>

            <TouchableOpacity style={styles.addButton} onPress={handleAddAtCurrentLocation}>
                <FontAwesome name="plus" size={24} color="white" />
            </TouchableOpacity>

            <AddPlaceModal
                visible={isAddModalVisible}
                onClose={() => setAddModalVisible(false)}
                onSave={handleSavePlace}
            />

            {selectedPlace && ( // Only render detail modal if a place is selected
                <PlaceDetailModal
                    visible={isDetailModalVisible}
                    onClose={() => setDetailModalVisible(false)}
                    place={selectedPlace}
                    onCommentAdded={fetchPlaces} // Callback to refresh places after comment/rating
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.theme.background },
    errorText: { fontSize: 16, color: Colors.theme.grey },
    infoBox: {
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
    },
    infoText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    // Styles for PlaceDetailModal
    detailImage: {
        width: '100%',
        height: 200,
        borderRadius: 10,
        marginBottom: 15,
        resizeMode: 'cover',
    },
    detailDescription: {
        fontSize: 16,
        color: Colors.theme.text,
        marginBottom: 10,
    },
    detailCategory: {
        fontSize: 14,
        color: Colors.theme.primary,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    detailRatingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        justifyContent: 'center', // Center align the rating info
    },
    detailRatingText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.theme.text,
        marginRight: 10,
    },
    starDisplayContainer: {
        flexDirection: 'row',
    },
    ratingCountText: {
        fontSize: 14,
        color: Colors.theme.grey,
        marginLeft: 8,
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.theme.text,
        marginBottom: 15,
    },
    commentInput: {
        minHeight: 80,
        borderColor: '#ddd',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginBottom: 15,
        fontSize: 16,
        textAlignVertical: 'top',
    },
    loginToCommentText: {
        textAlign: 'center',
        color: Colors.theme.primary,
        fontSize: 16,
        paddingVertical: 10,
    },
    commentContainer: {
        backgroundColor: '#f9f9f9',
        borderRadius: 10,
        padding: 15,
        marginBottom: 10,
        borderColor: '#eee',
        borderWidth: 1,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    commentUserPhoto: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
        backgroundColor: Colors.theme.secondary,
    },
    commentUserName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.theme.text,
    },
    commentStars: {
        flexDirection: 'row',
        marginTop: 2,
    },
    commentText: {
        fontSize: 14,
        color: Colors.theme.text,
    },
    commentDate: {
        fontSize: 12,
        color: Colors.theme.grey,
        marginLeft: 'auto', // Pushes the date to the right
    },

    // Existing styles (no changes needed for these unless specified)
    // calloutView: { 
    //     width: 220,
    //     height: 100,
    //     backgroundColor: 'white',
    //     borderRadius: 10,
    //     padding: 5,
    // },
    // calloutTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.theme.text },
    // calloutDescription: { fontSize: 14, color: Colors.theme.text, marginTop: 5 },
    // calloutCategory: { fontSize: 12, color: Colors.theme.primary, fontWeight: 'bold', marginTop: 5 },
    addButton: {
        position: 'absolute',
        bottom: 100,
        right: 20,
        backgroundColor: Colors.theme.primary,
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        zIndex: 10,
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContainer: { width: '90%', backgroundColor: 'white', borderRadius: 20, padding: 25, elevation: 10, maxHeight: '85%' }, // Adjusted maxHeight
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 5, textAlign: 'center', color: Colors.theme.text },
    // modalSubtitle: { fontSize: 14, color: Colors.theme.grey, textAlign: 'center', marginBottom: 20 },
    imagePicker: {
        height: 120,
        width: '100%',
        backgroundColor: '#f0f2f5',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    previewImage: {
        width: '100%',
        height: '100%',
        borderRadius: 10,
    },
    imagePickerText: {
        marginTop: 8,
        color: Colors.theme.primary,
        fontWeight: 'bold',
    },
    input: { height: 50, borderColor: '#ddd', borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, marginBottom: 15, fontSize: 16 },
    inputLabel: {
        fontSize: 14,
        color: Colors.theme.grey,
        fontWeight: '600',
        marginBottom: 5,
    },
    pickerButton: {
        height: 50,
        borderColor: '#ddd',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    pickerButtonText: {
        fontSize: 16,
    },
    pickerOptionsContainer: {
        borderColor: '#ddd',
        borderWidth: 1,
        borderRadius: 10,
        marginBottom: 15,
    },
    pickerOption: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    pickerOptionText: {
        fontSize: 16,
    },
    ratingLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.theme.text,
        textAlign: 'center',
        marginBottom: 10,
    },
    starInputContainer: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        marginBottom: 25,
    },
    saveButton: { backgroundColor: Colors.theme.accent, padding: 15, borderRadius: 10, alignItems: 'center' },
    saveButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    ruleText: {
        fontSize: 16,
        color: Colors.theme.grey,
        textAlign: 'center',
        marginBottom: 20,
    },
    ruleItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    ruleItemText: {
        flex: 1,
        fontSize: 15,
        color: Colors.theme.text,
        marginLeft: 10,
        lineHeight: 22,
    },
});