import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const isAuthenticated = () => {
  // 'is-authenticated' ではなく 'auth-token' の存在を確認
  const token = localStorage.getItem('auth-token');
  return !!token; // トークンがあればtrue, なければfalse
};

export const ProtectedRoute = () => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  return <Outlet />;
};