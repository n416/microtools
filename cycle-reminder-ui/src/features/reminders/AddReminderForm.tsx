import React, { useState } from 'react';
import { useAppDispatch } from '@/app/hooks.ts';
import { addReminder } from './remindersSlice.ts';
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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

// 仮のチャンネル一覧データ
const mockChannels = [
  { id: 'C123', name: '#general' },
  { id: 'C456', name: '#development' },
  { id: 'C789', name: '#random' },
  { id: 'C101', name: '#meeting' },
];

const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
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
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('#general');
  const [startTime, setStartTime] = useState('');

  const [recurrenceType, setRecurrenceType] = useState<'none' | 'weekly' | 'interval'>('none');
  const [weeklyDays, setWeeklyDays] = useState<string[]>([]);
  const [intervalHours, setIntervalHours] = useState(1);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleSetNow = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setStartTime(now.toISOString().slice(0, 16));
  };

  const handleSubmit = (e: React.FormEvent) => {
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

    dispatch(
      addReminder({
        message,
        channel,
        startTime: new Date(startTime).toISOString(),
        recurrence,
      })
    );
    navigate('/');
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        リマインダーを新規追加
      </Typography>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={3}>
          <TextField label="メッセージ" value={message} onChange={(e) => setMessage(e.target.value)} required fullWidth />
          
          <FormControl fullWidth>
            <InputLabel id="channel-select-label">チャンネル</InputLabel>
            <Select
              labelId="channel-select-label"
              value={channel}
              label="チャンネル"
              onChange={(e) => setChannel(e.target.value)}
            >
              {mockChannels.map((ch) => (
                <MenuItem key={ch.id} value={ch.name}>
                  {ch.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1} alignItems="flex-end">
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
              <InputLabel>曜日</InputLabel>
              <Select
                multiple
                displayEmpty
                value={weeklyDays}
                onChange={(e) => setWeeklyDays(e.target.value as string[])}
                input={<OutlinedInput label="曜日" />}
                renderValue={(selected) => {
                  if (selected.length === 0) return <em>曜日を選択...</em>;
                  return selected.map((day) => weekDayMap[day]).join(', ');
                }}
              >
                {weekDays.map((day) => (
                  <MenuItem key={day} value={day}>
                    <Checkbox checked={weeklyDays.indexOf(day) > -1} />
                    <ListItemText primary={weekDayMap[day]} />
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