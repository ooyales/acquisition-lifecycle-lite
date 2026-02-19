import { create } from 'zustand';
import type { User } from '../types';

const TOKEN_KEY = 'acql_token';
const USER_KEY = 'acql_user';

function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getStoredToken(),
  user: getStoredUser(),
  isAuthenticated: !!getStoredToken() && !!getStoredUser(),
  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
