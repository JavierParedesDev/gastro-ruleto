import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { app, db } from '../firebaseConfig';

interface Frame {
    name: string;
    url: string;
}

// Interfaz para los datos del perfil de usuario
export interface UserProfile {
    uid: string;
    name: string;
    lastName: string;
    age: string;
    email: string;
    photoURL?: string;
    followersCount?: number;
    followingCount?: number;
    badges?: string[];
    frames?: Frame[]; // Array para almacenar los marcos ganados
    equippedFrameUrl?: string; // URL del marco que el usuario tiene equipado
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isLoginPromptVisible: boolean;
  promptLogin: () => void;
  closeLoginPrompt: () => void;
  register: (email: string, pass: string, name: string, lastName: string, age: string) => Promise<void>;
  login: (email: string, pass: string) => Promise<any>;
  logout: () => Promise<void>;
  fetchUserProfile: (uid: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoginPromptVisible, setLoginPromptVisible] = useState(false);
  const auth = getAuth(app);

  const fetchUserProfile = useCallback(async (uid: string) => {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        setUser(docSnap.data() as UserProfile);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchUserProfile(firebaseUser.uid);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserProfile]);

  const promptLogin = () => setLoginPromptVisible(true);
  const closeLoginPrompt = () => setLoginPromptVisible(false);

  const register = async (email: string, pass: string, name: string, lastName: string, age: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const { uid } = userCredential.user;
    
    await setDoc(doc(db, "users", uid), {
        uid, name, lastName, age, email, photoURL: '', 
        followersCount: 0, followingCount: 0, 
        badges: [], frames: [], equippedFrameUrl: ''
    });
    
    await fetchUserProfile(uid);
  };

  const login = (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const logout = () => {
    return signOut(auth);
  };

  const value = { user, loading, isLoginPromptVisible, promptLogin, closeLoginPrompt, register, login, logout, fetchUserProfile };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
