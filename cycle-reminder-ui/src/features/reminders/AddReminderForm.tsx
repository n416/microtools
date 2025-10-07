import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks.ts';
import { addNewReminder } from './remindersSlice.ts';
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
  Divider,
  InputLabel,
  IconButton,
  CircularProgress,
  Paper,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
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

export const AddReminderForm = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const channels = useAppSelector(selectChannelsForServer(serverId!));
  const channelsStatus = useAppSelector(getChannelsStatus);

  useEffect(() => {
    if (serverId && !channels) {
      dispatch(fetchChannels({ serverId }));
    }
  }, [serverId, channels, dispatch]);

  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('');
  const [startTime, setStartTime] = useState('');
  const [startTimeValue, setStartTimeValue] = useState<Date | null>(null);

  const [recurrenceType, setRecurrenceType] = useState<'none' | 'weekly' | 'interval'>('none');
  const [weeklyDays, setWeeklyDays] = useState<string[]>([]);
  const [intervalHours, setIntervalHours] = useState(1);
  
  useEffect(() => {
    if (channels && channels.length > 0 && !channel) {
      setChannel(channels[0].name);
    }
  }, [channels, channel]);
  
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
    if (!message || !channel || !startTime || !serverId) return;

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
        addNewReminder({
          serverId,
          newReminder: { message, channel, startTime: new Date(startTime).toISOString(), recurrence, status: 'active' }
        })
      ).unwrap();
      
      // --- ★★★ ここから修正 ★★★ ---
      dispatch(showToast({ message: 'リマインダーを新しく追加しました。', severity: 'success' }));
      navigate(`/servers/${serverId}`);
    } catch (error) {
      console.error('Failed to save the reminder: ', error);
      dispatch(showToast({ message: 'リマインダーの追加に失敗しました。', severity: 'error' }));
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
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        リマインダーを新規追加
      </Typography>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={3}>
          <TextField label="メッセージ" value={message} onChange={(e) => setMessage(e.target.value)} required fullWidth />
          
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl fullWidth>
              <InputLabel id="channel-select-label">チャンネル</InputLabel>
              <Select
                labelId="channel-select-label"
                value={channel}
                label="チャンネル"
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
            <IconButton onClick={() => dispatch(fetchChannels({ serverId: serverId!, forceRefresh: true }))} disabled={channelsStatus === 'loading'}>
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
            <FormControl fullWidth>
              <Select
                multiple
                displayEmpty
                value={weeklyDays}
                onChange={(e) => setWeeklyDays(e.target.value as string[])}
                input={<OutlinedInput />}
                renderValue={(selected) => {
                  if (selected.length === 0) return <em>曜日を選択...</em>;
                  return selected.map((day) => weekDayMap[day]).join(', ');
                }}
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

          <Divider sx={{ pt: 2 }} />

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button variant="text" onClick={() => navigate(-1)}>
              戻る
            </Button>
            <Button type="submit" variant="contained" size="large">
              この内容で追加
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};