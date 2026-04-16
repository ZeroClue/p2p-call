import { useState, useEffect, useRef } from 'react';
import { auth, ensureAuthenticated } from '../firebase';

interface FirebaseUser {
  uid: string;
}

interface FirebaseError {
  code?: string;
  message?: string;
}

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const initCalledRef = useRef(false);

  useEffect(() => {
    const initAuth = async () => {
      if (initCalledRef.current) return;
      initCalledRef.current = true;

      try {
        await ensureAuthenticated();
        setIsAuthenticated(true);
        setAuthError(null);
      } catch (error: unknown) {
        console.error('Failed to authenticate:', error);

        const firebaseError = error as FirebaseError;
        let errorMessage = 'Authentication failed';
        if (
          firebaseError.code === 'auth/configuration-not-found' ||
          (firebaseError.message && firebaseError.message.includes('CONFIGURATION_NOT_FOUND'))
        ) {
          errorMessage =
            'Anonymous authentication is not enabled. Please enable it in Firebase Console: Authentication > Sign-in method > Anonymous';
        } else if (firebaseError.message) {
          errorMessage = firebaseError.message;
        }

        setAuthError(errorMessage);
        initCalledRef.current = false;
      } finally {
        setIsAuthenticating(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user: FirebaseUser | null) => {
      if (user) {
        setIsAuthenticated(true);
        setIsAuthenticating(false);
        setAuthError(null);
      } else {
        initAuth();
      }
    });

    return () => unsubscribe();
  }, []);

  return { isAuthenticated, isAuthenticating, authError };
};
