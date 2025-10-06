import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/app/hooks.ts';
import { selectAllReminders, deleteReminder, toggleReminderStatus, Reminder } from './remindersSlice.ts';
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
  Snackbar,
  Alert,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  IconButton,
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
import { useNavigate, useLocation } from 'react-router-dom';
import { EditReminderForm } from './EditReminderForm.tsx';

const dateTimeFormatOptions: Intl.DateTimeFormatOptions = {
  month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit'
};

const formatStartTime = (date: Date): string => {
  if (isNaN(date.getTime())) return "無効な日付";
  return new Intl.DateTimeFormat('ja-JP', dateTimeFormatOptions).format(date);
};

const ServerIcon = ({ iconName }: { iconName: string | null }) => {
  if (!iconName) return null;
  switch (iconName) {
    case 'game': return <VideogameAssetIcon />;
    case 'code': return <CodeIcon />;
    case 'work': return <WorkIcon />;
    case 'group': return <GroupIcon />;
    default: return null;
  }
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
      while (nextIntervalDate < now) {
        nextIntervalDate.setHours(nextIntervalDate.getHours() + reminder.recurrence.hours);
      }
      return nextIntervalDate;
    case 'weekly':
      const dayMap: { [key: string]: number } = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      const targetDays = reminder.recurrence.days.map(day => dayMap[day]);
      if (targetDays.length === 0) return null;
      let nextWeeklyDate = new Date(now);
      nextWeeklyDate.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds(), 0);
      for (let i = 0; i < 7; i++) {
        if (targetDays.includes(nextWeeklyDate.getDay()) && nextWeeklyDate > now) {
          return nextWeeklyDate;
        }
        nextWeeklyDate.setDate(nextWeeklyDate.getDate() + 1);
      }
      nextWeeklyDate.setDate(nextWeeklyDate.getDate() - 7);
      while(!targetDays.includes(nextWeeklyDate.getDay())) {
        nextWeeklyDate.setDate(nextWeeklyDate.getDate() + 1);
      }
      nextWeeklyDate.setDate(nextWeeklyDate.getDate() + 7);
      return nextWeeklyDate;
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
  const location = useLocation();
  const { serverName, serverIconName, linkedReminderId } = location.state || { serverName: 'リマインダー一覧', serverIconName: null, linkedReminderId: null };

  useEffect(() => {
    if (linkedReminderId) {
      const element = document.getElementById(`reminder-${linkedReminderId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
        setTimeout(() => {
          element.style.backgroundColor = '';
        }, 2000);
      }
      window.history.replaceState({}, document.title);
    }
  }, [linkedReminderId]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [currentReminderId, setCurrentReminderId] = useState<null | string>(null);
  const isMenuOpen = Boolean(menuAnchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, reminderId: string) => {
    setMenuAnchorEl(event.currentTarget);
    setCurrentReminderId(reminderId);
  };
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setCurrentReminderId(null);
  };

  const reminders = useAppSelector(selectAllReminders);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleTestSend = (message: string) => {
    const transformedMessage = message.replace(/@/g, 'あっと：');
    const fullTestMessage = `＝＝＝テスト送信です＝＝＝\n${transformedMessage}`;
    console.log('--- Test Send ---');
    console.log(fullTestMessage);
    console.log('-----------------');
    setSnackbarOpen(true);
  };
  
  const selectedReminder = reminders.find(r => r.id === currentReminderId);

  return (
    <>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Avatar><ServerIcon iconName={serverIconName} /></Avatar>
        <Typography variant="h5">
          {serverName}
        </Typography>
      </Stack>

      <Stack spacing={1.5}>
        {reminders.map((reminder) => {
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
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <TagIcon color="action" sx={{ fontSize: 20 }}/>
                        <Typography variant="body2" color="text.secondary" sx={{ width: '80px', flexShrink: 0 }}>
                          チャンネル
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{reminder.channel}</Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <CalendarMonthIcon color="action" sx={{ fontSize: 20 }}/>
                        <Typography variant="body2" color="text.secondary" sx={{ width: '80px', flexShrink: 0 }}>
                          起点日時
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {isValidDate ? formatStartTime(startTime) : "無効な日付"}
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <AutorenewIcon color="action" sx={{ fontSize: 20 }}/>
                        <Typography variant="body2" color="text.secondary" sx={{ width: '80px', flexShrink: 0 }}>
                          サイクル
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{formatRecurrenceDetails(reminder)}</Typography>
                      </Stack>
                    </Stack>
                    <Divider />
                    <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                      <IconButton
                        aria-label="その他のアクション"
                        onClick={(e) => handleMenuClick(e, reminder.id)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                      <Button
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => setEditingId(reminder.id)}
                      >
                        編集
                      </Button>
                    </Stack>
                  </Stack>
                )}
              </AccordionDetails>
            </Accordion>
          )
        })}
      </Stack>

      <Menu
        anchorEl={menuAnchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
      >
        {selectedReminder && (
          <div>
            <MenuItem onClick={() => {
              dispatch(toggleReminderStatus(selectedReminder.id));
              handleMenuClose();
            }}>
              <ListItemIcon>
                {selectedReminder.status === 'paused' ? <PlayCircleOutlineIcon fontSize="small" /> : <PauseCircleOutlineIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText>{selectedReminder.status === 'paused' ? '再開する' : '休止する'}</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => {
              handleTestSend(selectedReminder.message);
              handleMenuClose();
            }}>
              <ListItemIcon><SendIcon fontSize="small" /></ListItemIcon>
              <ListItemText>テスト送信</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem sx={{ color: 'error.main' }} onClick={() => {
              dispatch(deleteReminder(selectedReminder.id));
              handleMenuClose();
            }}>
              <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText>削除</ListItemText>
            </MenuItem>
          </div>
        )}
      </Menu>

      <Fab color="primary" sx={{ position: 'fixed', bottom: 32, right: 32 }} onClick={() => navigate('/add')}>
        <AddIcon />
      </Fab>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
          テスト送信しました！
        </Alert>
      </Snackbar>
    </>
  );
};