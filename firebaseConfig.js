// En el archivo: firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ¡¡PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE!!
const firebaseConfig = {
  apiKey: "AIzaSyBz_zHNM7LxxU92eJ_HZjIUG-5H-meFRy8",
  authDomain: "gastro-ruleto.firebaseapp.com",
  projectId: "gastro-ruleto",
  storageBucket: "gastro-ruleto.firebasestorage.app",
  messagingSenderId: "408953130510",
  appId: "1:408953130510:web:056738bb63797bb480765f",
  measurementId: "G-W3N6DSB8RB",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };

