import React, { createContext, useEffect, useState } from 'react';
import { auth, signOut } from '../firebase';
import persistenceService from '../services/persistenceService';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const performLogout = async () => {
    await signOut();
  };

  useEffect(() => {
    console.log('Setting up Firebase auth listener...');
    
    try {
      // Use v8 compat style auth listener
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
        
        // If user is logged in
        if (user) {
          // Check if this is a persisted session (not a fresh login)
          // Only persisted sessions will have an authPersistedAt timestamp
          const authPersistedAt = await persistenceService.getAuthPersistedAt();
          
          if (authPersistedAt) {
            // This is a persisted session from a previous app launch
            // Now check if it's still valid
            const sessionValid = await persistenceService.isSessionValid();
            
            if (!sessionValid) {
              // Session expired or invalid (either > 30 days or Remember Me was unchecked)
              console.log('Persisted session expired or invalid, signing out...');
              await signOut();
              setUser(null);
              if (initializing) {
                setInitializing(false);
              }
              return; // Exit early, don't set the user
            }
          }
          
          // Either it's a fresh login or a valid persisted session
          setUser(user);
        } else {
          setUser(null);
        }
        
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
    <AuthContext.Provider value={{ user, performLogout }}>
      {children}
    </AuthContext.Provider>
  );
}