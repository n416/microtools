import React from 'react';
import { useAppSelector, useAppDispatch } from '@/app/hooks.ts';
import { selectAllLogs, LogEntry } from './auditLogSlice';
import { addReminder } from '@/features/reminders/remindersSlice';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Button,
  Snackbar,
  Alert,
  Link as MuiLink,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import LinkIcon from '@mui/icons-material/Link'; // リンクアイコンをインポート

const DiffViewer = ({ log }: { log: LogEntry }) => {
  const { before, after, action } = log;
  
  if ((action === '作成' || action === '復元') && after) {
    return <Typography variant="caption" sx={{ color: 'success.light', display: 'block', whiteSpace: 'pre-wrap' }}>{JSON.stringify(after, null, 2)}</Typography>;
  }

  if (action === '削除' && before) {
    return <Typography variant="caption" sx={{ color: 'error.light', display: 'block', whiteSpace: 'pre-wrap' }}>{JSON.stringify(before, null, 2)}</Typography>;
  }
  
  if (before && after) {
    const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    const changes = allKeys.filter(key => JSON.stringify((before as any)[key]) !== JSON.stringify((after as any)[key]));

    if (changes.length === 0) return <Typography variant="caption" color="text.secondary">変更点はありませんでした。</Typography>;

    return (
      <Stack spacing={0.5}>
        {changes.map(key => (
          <Box key={key}>
            <Typography variant="caption" color="text.secondary">{key}:</Typography>
            <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'error.light' }}>
              {JSON.stringify((before as any)[key])}
            </Typography>
            <Typography variant="body2" sx={{ color: 'success.light' }}>
              {JSON.stringify((after as any)[key])}
            </Typography>
          </Box>
        ))}
      </Stack>
    );
  }

  return null;
};

export const AuditLogView = () => {
  const logs = useAppSelector(selectAllLogs);
  const dispatch = useAppDispatch();
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);

  const handleRestore = (logEntry: LogEntry) => {
    const dataToRestore = logEntry.after || logEntry.before;
    if (!dataToRestore) return;

    dispatch(addReminder({
      ...(dataToRestore as any),
      message: `[復元] ${(dataToRestore as any).message}`,
      status: 'paused',
    }));

    setSnackbarOpen(true);
  };

  const getActionColor = (action: string): "success" | "info" | "error" | "default" | "warning" | "primary" | "secondary" => {
    if (action === '作成') return 'success';
    if (action === '更新') return 'info';
    if (action === '削除') return 'error';
    if (action === '休止') return 'warning';
    if (action === '再開') return 'info';
    if (action === '復元') return 'primary';
    return 'default';
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        操作ログ
      </Typography>
      <Typography paragraph color="text.secondary">
        直近30件の操作履歴が表示されます。
      </Typography>

      <Stack spacing={2}>
        {logs.map(log => {
          const reminderId = (log.after as any)?.id || (log.before as any)?.id;
          return (
            <Card key={log.id} variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                  <Chip label={log.action} color={getActionColor(log.action)} size="small" />
                  <Typography variant="body2" color="text.secondary">
                    {new Date(log.timestamp).toLocaleString('ja-JP')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    by {log.user}
                  </Typography>
                </Stack>
                {log.action !== '削除' && reminderId ? (
                  <MuiLink
                    component={RouterLink}
                    to="/"
                    state={{ linkedReminderId: reminderId }}
                    underline="hover"
                    sx={{ color: 'primary.main', display: 'inline-flex', alignItems: 'center' }}
                  >
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <LinkIcon sx={{ fontSize: '1rem' }} />
                      <Typography variant="subtitle1" component="div" gutterBottom sx={{ mb: 0 }}>
                        {log.reminderMessage}
                      </Typography>
                    </Stack>
                  </MuiLink>
                ) : (
                  <Typography variant="subtitle1" component="div" gutterBottom sx={{ textDecoration: 'line-through', color: 'text.disabled' }}>
                    {log.reminderMessage}
                  </Typography>
                )}
                <Box sx={{ mt: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <DiffViewer log={log} />
                </Box>
                {(log.action === '更新' || log.action === '削除') && (
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleRestore(log)}
                    >
                      この内容で復元
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          );
        })}
        {logs.length === 0 && <Typography>操作ログはまだありません。</Typography>}
      </Stack>
      <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)}>
        <Alert onClose={() => setSnackbarOpen(false)} severity="info" sx={{ width: '100%' }}>
          休止状態でリマインダーを復元しました。
        </Alert>
      </Snackbar>
    </Box>
  );
};