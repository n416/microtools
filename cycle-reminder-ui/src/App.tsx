import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute'; // 追加
import { LoginPage } from '@/pages/LoginPage'; // 追加
import { ReminderList } from '@/features/reminders/ReminderList';
import { AddReminderForm } from '@/features/reminders/AddReminderForm';
import { ServerList } from '@/features/servers/ServerList';
import { AuditLogView } from '@/features/auditLog/AuditLogView';
import { CssBaseline, Container } from '@mui/material';

function App() {
  return (
    <>
      <CssBaseline />
      <Routes>
        {/* 未ログイン時に表示されるルート */}
        <Route path="/login" element={<LoginPage />} />

        {/* ログイン済みの場合のみ表示されるルート */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Container maxWidth="md"><ReminderList /></Container>} />
            <Route path="/add" element={<Container maxWidth="md"><AddReminderForm /></Container>} />
            <Route path="/servers" element={<Container maxWidth="md"><ServerList /></Container>} />
            <Route path="/log" element={<Container maxWidth="md"><AuditLogView /></Container>} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}

export default App;