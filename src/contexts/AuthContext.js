import React, { createContext, useEffect, useState } from 'react';
import { auth } from '../firebase';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    console.log('Setting up Firebase auth listener...');
    
    try {
      // Use v8 compat style auth listener
      const unsubscribe = auth.onAuthStateChanged((user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
        setUser(user);
        if (initializing) {
          setInitializing(false);
        }
      }, (error) => {
        console.error('Auth state change error:', error);
        setInitializing(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up Firebase auth:', error);
      setInitializing(false);
    }
  }, [initializing]);

  if (initializing) {
    console.log('Auth still initializing...');
    return null; // You can return a loading screen here
  }

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
}