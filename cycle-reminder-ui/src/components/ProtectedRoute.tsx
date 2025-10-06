import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const isAuthenticated = () => {
  try {
    const item = localStorage.getItem('is-authenticated');
    return item ? JSON.parse(item) : false;
  } catch (error) {
    return false;
  }
};

export const ProtectedRoute = () => {
  if (!isAuthenticated()) {
    // ログインしていなければ、/login ページにリダイレクト
    return <Navigate to="/login" />;
  }
  // ログインしていれば、子要素（アプリ本体のLayout）を表示
  return <Outlet />;
};