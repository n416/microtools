import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks.ts';
import { updateExistingReminder, Reminder } from './remindersSlice.ts';
import { fetchChannels, selectChannelsForServer, getChannelsStatus } from '../channels/channelsSlice.ts';
import { showToast } from '@/features/toast/toastSlice'; // 1. showToastをインポート
import {
  Box,
  TextField,
  Button,
  Stack,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  InputLabel,
  IconButton,
  CircularProgress,
  Paper,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RefreshIcon from '@mui/icons-material/Refresh';
import Calendar from 'react-calendar';
import Clock from 'react-clock';
import 'react-calendar/dist/Calendar.css';
import 'react-clock/dist/Clock.css';

const weekDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const weekDayMap: { [key: string]: string } = {
  monday: '月曜',
  tuesday: '火曜',
  wednesday: '水曜',
  thursday: '木曜',
  friday: '金曜',
  saturday: '土曜',
  sunday: '日曜',
};

interface EditReminderFormProps {
  reminder: Reminder;
  onCancel: () => void;
}

export const EditReminderForm: React.FC<EditReminderFormProps> = ({ reminder, onCancel }) => {
  const dispatch = useAppDispatch();
  
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const channels = useAppSelector(selectChannelsForServer(reminder.serverId));
  const channelsStatus = useAppSelector(getChannelsStatus);

  useEffect(() => {
    if (reminder.serverId && !channels) {
      dispatch(fetchChannels({ serverId: reminder.serverId }));
    }
  }, [reminder.serverId, channels, dispatch]);

  const [message, setMessage] = useState(reminder.message);
  const [channel, setChannel] = useState('');
  const [startTime, setStartTime] = useState(new Date(reminder.startTime).toISOString().slice(0, 16));
  const [startTimeValue, setStartTimeValue] = useState<Date | null>(new Date(reminder.startTime));

  const [recurrenceType, setRecurrenceType] = useState(reminder.recurrence.type);
  const [weeklyDays, setWeeklyDays] = useState(reminder.recurrence.type === 'weekly' ? reminder.recurrence.days : []);
  const [intervalHours, setIntervalHours] = useState(reminder.recurrence.type === 'interval' ? reminder.recurrence.hours : 1);
  
  useEffect(() => {
    if (channels) {
      const channelExists = channels.some(ch => ch.name === reminder.channel);
      if (channelExists) {
        setChannel(reminder.channel);
      } else if (channels.length > 0) {
        setChannel(channels[0].name);
      }
    }
  }, [channels, reminder.channel]);
  
  useEffect(() => {
    try {
      const date = new Date(startTime);
      if (!isNaN(date.getTime())) {
        setStartTimeValue(date);
      } else {
        setStartTimeValue(null);
      }
    } catch {
      setStartTimeValue(null);
    }
  }, [startTime]);

  const handleSetNow = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    now.setSeconds(0, 0);
    setStartTime(now.toISOString().slice(0, 16));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message || !channel || !startTime) return;

    let recurrence: any;
    if (recurrenceType === 'weekly') {
      recurrence = { type: 'weekly', days: weeklyDays };
    } else if (recurrenceType === 'interval') {
      recurrence = { type: 'interval', hours: Number(intervalHours) };
    } else {
      recurrence = { type: 'none' };
    }

    try {
      await dispatch(
        updateExistingReminder({
          id: reminder.id,
          serverId: reminder.serverId,
          message,
          channel,
          startTime: new Date(startTime).toISOString(),
          recurrence,
          status: reminder.status,
        })
      ).unwrap();
      
      // --- ★★★ ここから修正 ★★★ ---
      dispatch(showToast({ message: 'リマインダーを更新しました。', severity: 'success' }));
      onCancel();
    } catch (error) {
      console.error('Failed to update the reminder: ', error);
      dispatch(showToast({ message: 'リマインダーの更新に失敗しました。', severity: 'error' }));
      // --- ★★★ ここまで修正 ★★★ ---
    }
  };
  
  const tileClassName = ({ date, view }: { date: Date, view: string }) => {
    if (view === 'month') {
      const dayName = weekDays[date.getDay()];
      if (weeklyDays.includes(dayName)) {
        return 'react-calendar__tile--active';
      }
    }
    return null;
  };
  
  const renderIntervalClocks = () => {
    if (!startTimeValue) return null;
    const now = new Date();
    const clocks = [];
    
    let nextStartTime = new Date(startTimeValue);
    while (nextStartTime <= now) {
      nextStartTime.setHours(nextStartTime.getHours() + intervalHours);
    }

    for (let i = 0; i < 3; i++) {
      const nextTime = new Date(nextStartTime.getTime() + i * intervalHours * 60 * 60 * 1000);
      clocks.push(
        <Stack key={i} alignItems="center" spacing={1}>
          <Clock value={nextTime} size={isSmallScreen ? 70 : 100} renderNumbers />
          <Typography variant="caption">{nextTime.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Typography>
        </Stack>
      );
    }
    return clocks;
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{ p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
      <Stack spacing={3}>
        <TextField label="メッセージ" value={message} onChange={(e) => setMessage(e.target.value)} required fullWidth variant="filled" />

        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl fullWidth variant="filled">
            <InputLabel id="channel-select-label">チャンネル</InputLabel>
            <Select
              labelId="channel-select-label"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              disabled={!channels}
            >
              {channels ? channels.map((ch) => (
                <MenuItem key={ch.id} value={ch.name}>
                  {ch.name}
                </MenuItem>
              )) : <MenuItem disabled>チャンネルを読み込み中...</MenuItem>}
            </Select>
          </FormControl>
          <IconButton onClick={() => dispatch(fetchChannels({ serverId: reminder.serverId, forceRefresh: true }))} disabled={channelsStatus === 'loading'}>
              {channelsStatus === 'loading' ? <CircularProgress size={24} /> : <RefreshIcon />}
            </IconButton>
        </Stack>
        
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch">
          <TextField
            label="起点日時"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
            fullWidth
            variant="filled"
          />
          <Button variant="outlined" onClick={handleSetNow} startIcon={<AccessTimeIcon />}>
            NOW!
          </Button>
        </Stack>

        <FormControl component="fieldset">
          <FormLabel component="legend">サイクル</FormLabel>
          <RadioGroup row value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value as any)}>
            <FormControlLabel value="none" control={<Radio />} label="繰り返しなし" />
            <FormControlLabel value="weekly" control={<Radio />} label="週次" />
            <FormControlLabel value="interval" control={<Radio />} label="時間間隔" />
          </RadioGroup>
        </FormControl>

        {recurrenceType === 'weekly' && (
          <FormControl fullWidth variant="filled">
            <Select
              multiple
              displayEmpty
              value={weeklyDays}
              onChange={(e) => setWeeklyDays(e.target.value as string[])}
              input={<OutlinedInput />}
              renderValue={(selected) => (selected.length === 0 ? <em>曜日を選択...</em> : selected.map((day) => weekDayMap[day]).join(', '))}
            >
              {Object.entries(weekDayMap).map(([key, value]) => (
                <MenuItem key={key} value={key}>
                  <Checkbox checked={weeklyDays.includes(key)} />
                  <ListItemText primary={value} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {recurrenceType === 'interval' && (
          <TextField
            label="何時間ごと"
            type="number"
            value={intervalHours}
            onChange={(e) => setIntervalHours(Number(e.target.value))}
            inputProps={{ min: 1 }}
            variant="filled"
          />
        )}

        {startTimeValue && (
            <Paper variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              {recurrenceType === 'none' && (
                <Stack alignItems="center" spacing={1}>
                  <Clock value={startTimeValue} size={isSmallScreen ? 120 : 150} renderNumbers />
                  <Typography variant="caption">この日時に1回だけ通知</Typography>
                </Stack>
              )}
              {recurrenceType === 'weekly' && (
                <Box sx={{ pointerEvents: 'none', width: '100%', maxWidth: '350px', '& .react-calendar': { width: '100% !important' } }}>
                  <Calendar
                    value={startTimeValue}
                    tileClassName={tileClassName}
                    showNeighboringMonth={false}
                    showNavigation={false}
                    formatShortWeekday={(locale, date) => ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]}
                    formatDay={isSmallScreen ? (locale, date) => date.getDate().toString() : undefined}
                  />
                </Box>
              )}
              {recurrenceType === 'interval' && renderIntervalClocks()}
            </Paper>
          )}

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button onClick={onCancel}>キャンセル</Button>
          <Button type="submit" variant="contained">
            更新する
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};