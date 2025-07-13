import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";

// Tu configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBz_zHNM7LxxU92eJ_HZjIUG-5H-meFRy8",
    authDomain: "gastro-ruleto.firebaseapp.com",
    projectId: "gastro-ruleto",
    storageBucket: "gastro-ruleto.firebasestorage.app",
    messagingSenderId: "408953130510",
    appId: "1:408953130510:web:056738bb63797bb480765f",
    measurementId: "G-W3N6DSB8RB",
};

// Inicialización segura para evitar el error "already-initialized"
let app;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

// Inicializar Auth con persistencia para que la sesión no se cierre
const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// Inicializar Firestore
const db = getFirestore(app);

// Exportar las instancias para usarlas en toda la app
export { app, auth, db };

