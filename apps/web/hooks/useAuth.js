'use client';

import { useState, useEffect, useCallback } from 'react';
import * as authService from '../services/auth.js';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = authService.getUser();
    setUser(u);
    setLoading(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!authService.isAuthenticated()) {
        setUser(null);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);
    setUser(authService.getUser());
    return data;
  }, []);

  const register = useCallback(async (email, password, displayName, workspaceName) => {
    const data = await authService.register(email, password, displayName, workspaceName);
    setUser(authService.getUser());
    return data;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logout,
  };
}
