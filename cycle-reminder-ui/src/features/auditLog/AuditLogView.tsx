import React, { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/app/hooks.ts';
import { selectAllLogs, getLogsStatus, fetchLogs, LogEntry } from './auditLogSlice';
import { addNewReminder } from '@/features/reminders/remindersSlice';
import { selectAllServers } from '@/features/servers/serversSlice';
import { selectWriteTokenForServer } from '@/features/auth/authSlice';
import { showToast } from '@/features/toast/toastSlice';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Button,
  Link as MuiLink,
  CircularProgress,
} from '@mui/material';
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';

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
  const { serverId } = useParams<{ serverId: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const logs = useAppSelector(selectAllLogs);
  const logsStatus = useAppSelector(getLogsStatus);
  const error = useAppSelector(state => state.auditLog.error);
  
  const servers = useAppSelector(selectAllServers);
  const writeToken = useAppSelector(selectWriteTokenForServer(serverId!));
  const currentServer = servers.find(s => s.id === serverId);
  const isServerAdmin = currentServer?.role === 'admin';
  const canWrite = isServerAdmin || !!writeToken;

  useEffect(() => {
    if (serverId) {
      dispatch(fetchLogs(serverId));
    }
  }, [serverId, dispatch]);

  const handleRestore = (logEntry: LogEntry) => {
    const dataToRestore = (logEntry.before || logEntry.after) as any;
    if (!dataToRestore || !serverId) return;

    dispatch(addNewReminder({
      serverId: serverId,
      newReminder: {
        message: `[復元] ${dataToRestore.message}`,
        channel: dataToRestore.channel,
        startTime: dataToRestore.startTime,
        recurrence: dataToRestore.recurrence,
        status: 'paused',
      }
    })).unwrap()
     .then(() => {
        dispatch(showToast({ message: '休止状態でリマインダーを復元しました。', severity: 'info' }));
      })
     .catch((err) => {
        console.error("復元に失敗しました:", err);
        dispatch(showToast({ message: '復元に失敗しました。', severity: 'error' }));
      });
  };

  const getActionColor = (action: string): "success" | "info" | "error" | "default" | "warning" | "primary" | "secondary" => {
    if (action === '作成') return 'success';
    if (action === '更新') return 'info';
    if (action === '削除') return 'error';
    if (action === '休止' || action === '再開') return 'warning';
    if (action === '復元') return 'primary';
    return 'default';
  };

  let content;
  if (logsStatus === 'loading' || logsStatus === 'idle') {
    content = <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  } else if (logsStatus === 'succeeded') {
    content = (
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
                  <MuiLink component={RouterLink} to={`/servers/${serverId}`} state={{ linkedReminderId: reminderId }} underline="hover" sx={{ color: 'inherit' }}>
                    <Typography variant="subtitle1" component="div" gutterBottom>{log.reminderMessage}</Typography>
                  </MuiLink>
                ) : (
                  <Typography variant="subtitle1" component="div" gutterBottom sx={{ textDecoration: 'line-through', color: 'text.disabled' }}>{log.reminderMessage}</Typography>
                )}
                <Box sx={{ mt: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <DiffViewer log={log} />
                </Box>
                {(log.action === '更新' || log.action === '削除') && (
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="outlined" size="small" onClick={() => handleRestore(log)} disabled={!canWrite}>
                      この内容で復元
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          );
        })}
        {logs.length === 0 && <Typography>このサーバーの操作ログはまだありません。</Typography>}
      </Stack>
    );
  } else if (logsStatus === 'failed') {
    content = <Typography color="error">エラー: {error}</Typography>;
  }

  return (
    <Box>
      <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h5" gutterBottom>
            操作ログ
          </Typography>
          <Typography paragraph color="text.secondary">
            直近30件の操作履歴が表示されます。
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => navigate(`/servers/${serverId}`)}>
          リマインダー一覧へ戻る
        </Button>
      </Stack>
      
      {content}
    </Box>
  );
};