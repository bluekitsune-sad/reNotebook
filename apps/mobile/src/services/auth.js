import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './api.js';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export async function login(email, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));

  return data;
}

export async function register(email, password, displayName, workspaceName) {
  const data = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName, workspaceName }),
  });

  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));

  return data;
}

export async function logout() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getStoredUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function isAuthenticated() {
  const token = await getToken();
  return token !== null;
}
