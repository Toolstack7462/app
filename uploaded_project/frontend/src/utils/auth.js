// Authentication utilities (frontend-only)
import { safeRead, safeWrite, safeRemove, STORAGE_KEYS } from './storage';

// Admin credentials (in production, these would be env variables)
export const ADMIN_CREDENTIALS = {
  email: 'admin@toolstack.com',
  password: 'admin123' // Change in production
};

export const ROLES = {
  ADMIN: 'ADMIN',
  CLIENT: 'CLIENT'
};

export const getSession = () => {
  return safeRead(STORAGE_KEYS.SESSION, null);
};

export const setSession = (sessionData) => {
  return safeWrite(STORAGE_KEYS.SESSION, {
    ...sessionData,
    createdAt: new Date().toISOString()
  });
};

export const clearSession = () => {
  return safeRemove(STORAGE_KEYS.SESSION);
};

export const isAuthenticated = () => {
  const session = getSession();
  return session !== null;
};

export const isAdmin = () => {
  const session = getSession();
  return session && session.role === ROLES.ADMIN;
};

export const isClient = () => {
  const session = getSession();
  return session && session.role === ROLES.CLIENT;
};

export const getCurrentUser = () => {
  return getSession();
};

export const adminLogin = (email, password) => {
  if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
    setSession({
      role: ROLES.ADMIN,
      email: email
    });
    return { success: true };
  }
  return { success: false, error: 'Invalid credentials' };
};
