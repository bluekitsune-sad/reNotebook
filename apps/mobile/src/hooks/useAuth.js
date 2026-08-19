import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import * as authService from '../services/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await authService.getStoredUser();
        const hasToken = await authService.isAuthenticated();
        if (hasToken && stored) {
          setUser(stored);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loginAction = useCallback(async (email, password) => {
    const data = await authService.login(email, password);
    setUser(data.user);
    return data;
  }, []);

  const registerAction = useCallback(async (email, password, displayName, workspaceName) => {
    const data = await authService.register(email, password, displayName, workspaceName);
    setUser(data.user);
    return data;
  }, []);

  const logoutAction = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        loading,
        login: loginAction,
        register: registerAction,
        logout: logoutAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
