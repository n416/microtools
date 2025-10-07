import { Route, Routes, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { ReminderList } from '@/features/reminders/ReminderList';
import { AddReminderForm } from '@/features/reminders/AddReminderForm';
import { ServerList } from '@/features/servers/ServerList';
import { AuditLogView } from '@/features/auditLog/AuditLogView';
import { CssBaseline, Container } from '@mui/material';
import { Toast } from '@/features/toast/Toast'; // 1. Toastをインポート

function App() {
  return (
    <>
      <CssBaseline />
      {/* 2. Toastコンポーネントを配置 */}
      <Toast />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/servers" replace />} />
            <Route path="/servers" element={<Container maxWidth="md"><ServerList /></Container>} />
            <Route path="/servers/:serverId" element={<Container maxWidth="md"><ReminderList /></Container>} />
            <Route path="/servers/:serverId/add" element={<Container maxWidth="md"><AddReminderForm /></Container>} />
            <Route path="/servers/:serverId/log" element={<Container maxWidth="md"><AuditLogView /></Container>} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}

export default App;