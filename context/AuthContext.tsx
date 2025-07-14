import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebaseConfig';


interface Frame { name: string; url: string; }

export interface UserProfile {
    uid: string;
    nickname: string;
    name: string;
    lastName: string;
    birthDate: string; 
    gender: string;   
    email: string;
    description?: string;
    photoURL?: string;
    followersCount?: number;
    followingCount?: number;
    badges?: string[];
    frames?: Frame[];
    equippedFrameUrl?: string;
    viewedBadgesCount?: number; 
    viewedFramesCount?: number;
    nicknameLastChanged?: any; // **NUEVO CAMPO**
}

interface RegistrationData {
    email: string;
    pass: string;
    name: string;
    lastName: string;
    birthDate: string;
    gender: string;
    nickname: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isLoginPromptVisible: boolean;
  promptLogin: () => void;
  closeLoginPrompt: () => void;
  register: (data: RegistrationData) => Promise<void>;
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

  const register = async (data: RegistrationData) => {
    const { email, pass, name, lastName, birthDate, gender, nickname } = data;
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const { uid } = userCredential.user;
    
    const batch = writeBatch(db);

    const userRef = doc(db, "users", uid);
    batch.set(userRef, {
        uid, nickname, name, lastName, birthDate, gender, email, photoURL: '', description: '',
        followersCount: 0, followingCount: 0, 
        badges: [], frames: [], equippedFrameUrl: '',
        viewedBadgesCount: 0, viewedFramesCount: 0, 
        nicknameLastChanged: serverTimestamp(), // **AÑADIDO**: Se establece la fecha de creación.
    });

    const nicknameRef = doc(db, "nicknames", nickname.toLowerCase());
    batch.set(nicknameRef, { userId: uid, nickname_lowercase: nickname.toLowerCase() });
    
    await batch.commit();
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
