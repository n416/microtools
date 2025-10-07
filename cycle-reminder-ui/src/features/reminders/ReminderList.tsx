import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/app/hooks.ts';
import { selectAllReminders, getRemindersStatus, fetchReminders, deleteExistingReminder, toggleStatusAsync, Reminder } from './remindersSlice.ts';
import { selectAllServers, getServersStatus, getLastFetched, fetchServers } from '@/features/servers/serversSlice';
import { selectWriteTokenForServer, setWriteToken } from '@/features/auth/authSlice';
import { showToast } from '@/features/toast/toastSlice'; // ★ showToast をインポート
import {
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Fab,
  Stack,
  Divider,
  Button,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  TextField,
  DialogActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import SpeakerNotesIcon from '@mui/icons-material/SpeakerNotes';
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset';
import CodeIcon from '@mui/icons-material/Code';
import WorkIcon from '@mui/icons-material/Work';
import GroupIcon from '@mui/icons-material/Group';
import TagIcon from '@mui/icons-material/Tag';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SendIcon from '@mui/icons-material/Send';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import HistoryIcon from '@mui/icons-material/History';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { EditReminderForm } from './EditReminderForm.tsx';
import apiClient from '@/api/client';

const getServerIconUrl = (id: string, iconHash: string | null) => {
  if (!iconHash) return null;
  return `https://cdn.discordapp.com/icons/${id}/${iconHash}.png`;
};

const dateTimeFormatOptions: Intl.DateTimeFormatOptions = {
  month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit'
};

const formatStartTime = (date: Date): string => {
  if (isNaN(date.getTime())) return "無効な日付";
  return new Intl.DateTimeFormat('ja-JP', dateTimeFormatOptions).format(date);
};

const ServerIcon = ({ iconName, serverName }: { iconName: string | null, serverName: string }) => {
  if (!serverName) {
    return null;
  }
  if (iconName) {
    switch (iconName) {
      case 'game': return <VideogameAssetIcon />;
      case 'code': return <CodeIcon />;
      case 'work': return <WorkIcon />;
      case 'group': return <GroupIcon />;
      default: return <>{serverName.charAt(0)}</>;
    }
  }
  return <>{serverName.charAt(0)}</>;
};

const weekDayMap: { [key: string]: string } = {
  monday: '月', tuesday: '火', wednesday: '水', thursday: '木', friday: '金', saturday: '土', sunday: '日'
};

const formatRecurrenceDetails = (reminder: Reminder): string => {
  const date = new Date(reminder.startTime);
  if (isNaN(date.getTime())) return "日付設定エラー";
  const timeString = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  switch (reminder.recurrence.type) {
    case 'weekly':
      const days = reminder.recurrence.days.map(day => weekDayMap[day]).join(',');
      return `毎週${days}曜日の${timeString}に通知`;
    case 'interval':
      return `${reminder.recurrence.hours}時間ごとに通知`;
    case 'none':
    default:
      return "繰り返しなし";
  }
};

const calculateNextOccurrence = (reminder: Reminder): Date | null => {
  const now = new Date();
  const startDate = new Date(reminder.startTime);
  if (isNaN(startDate.getTime())) return null;

  switch (reminder.recurrence.type) {
    case 'none':
      return startDate > now ? startDate : null;

    case 'interval':
      let nextIntervalDate = new Date(startDate);
      while (nextIntervalDate <= now) {
        nextIntervalDate.setHours(nextIntervalDate.getHours() + reminder.recurrence.hours);
      }
      return nextIntervalDate;

    case 'weekly': {
      const dayMap: { [key: string]: number } = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      const targetDaysOfWeek = reminder.recurrence.days.map(day => dayMap[day]);

      if (targetDaysOfWeek.length === 0) return null;

      let nextDate = new Date(now);
      nextDate.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds(), 0);

      for (let i = 0; i < 7; i++) {
        if (targetDaysOfWeek.includes(nextDate.getDay()) && nextDate > now) {
          return nextDate;
        }
        nextDate.setDate(nextDate.getDate() + 1);
      }
      
      for (let i = 0; i < 7; i++) {
        if (targetDaysOfWeek.includes(nextDate.getDay())) {
          return nextDate;
        }
        nextDate.setDate(nextDate.getDate() + 1);
      }
    }
  }
  return null;
};

const formatNextOccurrence = (reminder: Reminder): string => {
  if (reminder.status === 'paused') {
    return '休止中';
  }
  const date = calculateNextOccurrence(reminder);
  if (!date) return '終了または設定エラー';
  return new Intl.DateTimeFormat('ja-JP', dateTimeFormatOptions).format(date);
};

export const ReminderList = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const reminders = useAppSelector(selectAllReminders);
  const remindersStatus = useAppSelector(getRemindersStatus);
  const error = useAppSelector(state => state.reminders.error);
  
  const servers = useAppSelector(selectAllServers);
  const serversStatus = useAppSelector(getServersStatus);
  const lastFetched = useAppSelector(getLastFetched);
  const writeToken = useAppSelector(selectWriteTokenForServer(serverId!));
  
  const currentServer = servers.find(s => s.id === serverId);
  const isServerAdmin = currentServer?.role === 'admin';
  const canWrite = isServerAdmin || !!writeToken;

  const serverName = currentServer?.name || '';
  const serverIconUrl = currentServer ? getServerIconUrl(currentServer.id, currentServer.icon) : null;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [currentReminderId, setCurrentReminderId] = useState<null | string>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const isMenuOpen = Boolean(menuAnchorEl);

  useEffect(() => {
    const CACHE_DURATION = 5 * 60 * 1000;
    const now = Date.now();
    if (serversStatus !== 'loading') {
      if (!lastFetched || (now - lastFetched > CACHE_DURATION)) {
        dispatch(fetchServers());
      }
    }
  }, [dispatch, lastFetched, serversStatus]);

  useEffect(() => {
    if (serverId) {
      dispatch(fetchReminders(serverId));
    }
  }, [serverId, dispatch]);

  useEffect(() => {
    if (currentServer && isServerAdmin && !writeToken) {
      const getAdminToken = async () => {
        try {
          const response = await apiClient.post(`/servers/${serverId}/verify-password`, { password: '' });
          const { writeToken: adminToken } = response.data;
          dispatch(setWriteToken({ serverId: serverId!, token: adminToken }));
        } catch (error) {
          console.error("管理者トークンの自動取得に失敗しました:", error);
        }
      };
      getAdminToken();
    }
  }, [currentServer, isServerAdmin, writeToken, serverId, dispatch]);

  useEffect(() => {
    if (remindersStatus === 'succeeded' && location.state?.linkedReminderId) {
      const { linkedReminderId } = location.state;
      const reminderExists = reminders.some(r => r.id === linkedReminderId);

      if (reminderExists) {
        const element = document.getElementById(`reminder-${linkedReminderId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
          setTimeout(() => {
            element.style.backgroundColor = '';
          }, 2000);
        }
      } else {
        dispatch(showToast({ message: 'リンク先のリマインダーは削除されています。', severity: 'warning' }));
      }

      window.history.replaceState({ ...location.state, linkedReminderId: null }, document.title);
    }
  }, [remindersStatus, reminders, location.state, dispatch]);
  
  const handleUnlock = async () => {
    if (!password || !serverId) return;
    try {
      const response = await apiClient.post(`/servers/${serverId}/verify-password`, { password });
      const { writeToken } = response.data;
      dispatch(setWriteToken({ serverId, token: writeToken }));
      setPasswordModalOpen(false);
      setPasswordError('');
      setPassword('');
    } catch (error) {
      setPasswordError('パスワードが違います。');
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, reminderId: string) => {
    setMenuAnchorEl(event.currentTarget);
    setCurrentReminderId(reminderId);
  };
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setCurrentReminderId(null);
  };

  const handleTestSend = (message: string) => {
    const transformedMessage = message.replace(/@/g, 'あっと：');
    const fullTestMessage = `＝＝＝テスト送信です＝＝＝\n${transformedMessage}`;
    console.log('--- Test Send ---');
    console.log(fullTestMessage);
    console.log('-----------------');
    dispatch(showToast({ message: 'テスト送信しました！', severity: 'success' }));
  };
  
  const selectedReminder = reminders.find(r => r.id === currentReminderId);

  let content;
  if (remindersStatus === 'loading' || serversStatus !== 'succeeded' || !currentServer) {
    content = <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  } else if (remindersStatus === 'succeeded') {
    if (reminders.length > 0) {
      content = reminders.map((reminder) => {
        const startTime = new Date(reminder.startTime);
        const isValidDate = !isNaN(startTime.getTime());
        const isEditing = editingId === reminder.id;
        const isPaused = reminder.status === 'paused';

        return (
          <Accordion key={reminder.id} id={`reminder-${reminder.id}`} TransitionProps={{ unmountOnExit: true }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                <SpeakerNotesIcon color="action" />
                <Typography sx={{ flexGrow: 1, textDecoration: isPaused ? 'line-through' : 'none', color: isPaused ? 'text.disabled' : 'text.primary' }}>
                  {reminder.message}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary', mr: 2 }}>
                  <EventAvailableIcon fontSize="small" />
                  <Typography variant="body2" noWrap>{formatNextOccurrence(reminder)}</Typography>
                </Stack>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              {isEditing ? (
                <EditReminderForm reminder={reminder} onCancel={() => setEditingId(null)} />
              ) : (
                <Stack spacing={2}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" alignItems="center" spacing={1.5}><TagIcon color="action" sx={{ fontSize: 20 }}/><Typography variant="body2" color="text.secondary" sx={{ width: '80px', flexShrink: 0 }}>チャンネル</Typography><Typography variant="body1" sx={{ fontWeight: 500 }}>{reminder.channel}</Typography></Stack>
                    <Stack direction="row" alignItems="center" spacing={1.5}><CalendarMonthIcon color="action" sx={{ fontSize: 20 }}/><Typography variant="body2" color="text.secondary" sx={{ width: '80px', flexShrink: 0 }}>起点日時</Typography><Typography variant="body1" sx={{ fontWeight: 500 }}>{isValidDate ? formatStartTime(startTime) : "無効な日付"}</Typography></Stack>
                    <Stack direction="row" alignItems="center" spacing={1.5}><AutorenewIcon color="action" sx={{ fontSize: 20 }}/><Typography variant="body2" color="text.secondary" sx={{ width: '80px', flexShrink: 0 }}>サイクル</Typography><Typography variant="body1" sx={{ fontWeight: 500 }}>{formatRecurrenceDetails(reminder)}</Typography></Stack>
                  </Stack>
                  <Divider />
                  <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                    {canWrite && <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditingId(reminder.id)}>編集</Button>}
                    <IconButton aria-label="その他のアクション" onClick={(e) => handleMenuClick(e, reminder.id)}><MoreVertIcon /></IconButton>
                  </Stack>
                </Stack>
              )}
            </AccordionDetails>
          </Accordion>
        );
      });
    } else {
      content = <Typography sx={{ mt: 4, textAlign: 'center' }}>このサーバーにはリマインダーはまだありません。</Typography>;
    }
  } else if (remindersStatus === 'failed') {
    content = <Typography color="error">エラー: {error}</Typography>;
  }

  return (
    <>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar src={serverIconUrl || undefined}><ServerIcon iconName={null} serverName={serverName}/></Avatar>
          <Typography variant="h5">{serverName}</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button component={Link} to={`/servers/${serverId}/log`} variant="outlined" startIcon={<HistoryIcon />}>
            操作ログ
          </Button>
          {!canWrite && (
            <Button variant="outlined" startIcon={<LockOpenIcon />} onClick={() => setPasswordModalOpen(true)}>
              編集を有効にする
            </Button>
          )}
        </Stack>
      </Stack>

      <Stack spacing={1.5}>{content}</Stack>
      
      <Menu anchorEl={menuAnchorEl} open={isMenuOpen} onClose={handleMenuClose}>
        {selectedReminder && (
          <div>
            <MenuItem disabled={!canWrite} onClick={() => { dispatch(toggleStatusAsync(selectedReminder)); handleMenuClose(); }}>
              <ListItemIcon>{selectedReminder.status === 'paused' ? <PlayCircleOutlineIcon fontSize="small" /> : <PauseCircleOutlineIcon fontSize="small" />}</ListItemIcon>
              <ListItemText>{selectedReminder.status === 'paused' ? '再開する' : '休止する'}</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { handleTestSend(selectedReminder.message); handleMenuClose(); }}>
              <ListItemIcon><SendIcon fontSize="small" /></ListItemIcon>
              <ListItemText>テスト送信</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem disabled={!canWrite} sx={{ color: 'error.main' }} onClick={() => { 
                if (serverId) {
                  dispatch(deleteExistingReminder({ id: selectedReminder.id, serverId: serverId }));
                }
                handleMenuClose(); 
              }}>
              <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText>削除</ListItemText>
            </MenuItem>
          </div>
        )}
      </Menu>

      {canWrite && (
        <Fab color="primary" sx={{ position: 'fixed', bottom: 32, right: 32 }} onClick={() => navigate(`/servers/${serverId}/add`)}>
          <AddIcon />
        </Fab>
      )}

      <Dialog open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)}>
        <DialogTitle>パスワードの入力</DialogTitle>
        <DialogContent>
          <DialogContentText>このサーバーのリマインダーを編集するには、設定されたパスワードを入力してください。</DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="サーバーパスワード"
            type="password"
            fullWidth
            variant="standard"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={!!passwordError}
            helperText={passwordError}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPasswordModalOpen(false); setPasswordError(''); }}>キャンセル</Button>
          <Button onClick={handleUnlock}>アンロック</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};