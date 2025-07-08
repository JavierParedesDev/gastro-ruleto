import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.uid) {
      const notificationsRef = collection(db, 'notifications');
      const q = query(notificationsRef, where('userId', '==', user.uid), where('isRead', '==', false));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        setUnreadCount(querySnapshot.size);
      });

      // Limpiar la suscripción al desmontar
      return () => unsubscribe();
    } else {
      // Reiniciar el contador si el usuario cierra sesión
      setUnreadCount(0);
    }
  }, [user?.uid]);

  return (
    <NotificationContext.Provider value={{ unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
};
