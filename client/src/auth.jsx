import { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(undefined); // undefined = loading
  const [error, setError] = useState(null);      // the on-device database failed to open

  useEffect(() => {
    api.getMe().then(setUser).catch(err => { console.error(err); setError(err); });
  }, []);

  useEffect(() => {
    function handleExpired() { setUser(null); }
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
