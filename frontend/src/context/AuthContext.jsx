import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('erp_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('erp_token');
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          if (res.data.success) {
            setUser(res.data.data);
            localStorage.setItem('erp_user', JSON.stringify(res.data.data));
          }
        })
        .catch(() => {
          localStorage.removeItem('erp_token');
          localStorage.removeItem('erp_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    if (res.data.success) {
      const { token, user: userData } = res.data.data;
      localStorage.setItem('erp_token', token);
      localStorage.setItem('erp_user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    }
    throw new Error(res.data.message || 'Login failed');
  };

  const logout = () => {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    setUser(null);
    window.location.href = '/login';
  };

  const isAdmin = user?.role === 'ADMIN';
  const isSalesUser = user?.role === 'SALES_USER';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isSalesUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
