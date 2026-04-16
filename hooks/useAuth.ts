import { useState, useEffect, useRef } from 'react';
import { auth, ensureAuthenticated } from '../firebase';

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
      } catch (error: any) {
        console.error('Failed to authenticate:', error);

        let errorMessage = 'Authentication failed';
        if (error.code === 'auth/configuration-not-found' ||
            (error.message && error.message.includes('CONFIGURATION_NOT_FOUND'))) {
          errorMessage = 'Anonymous authentication is not enabled. Please enable it in Firebase Console: Authentication > Sign-in method > Anonymous';
        } else if (error.message) {
          errorMessage = error.message;
        }

        setAuthError(errorMessage);
        initCalledRef.current = false;
      } finally {
        setIsAuthenticating(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user: any) => {
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