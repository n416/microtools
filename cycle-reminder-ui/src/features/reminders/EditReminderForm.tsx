import React, { useState } from 'react';
import { useAppDispatch } from '@/app/hooks.ts';
import { updateReminder, Reminder } from './remindersSlice.ts';
import {
  Box,
  TextField,
  Button,
  Stack,
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
} from '@mui/material';
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

interface EditReminderFormProps {
  reminder: Reminder;
  onCancel: () => void;
}

export const EditReminderForm: React.FC<EditReminderFormProps> = ({ reminder, onCancel }) => {
  const dispatch = useAppDispatch();

  const [message, setMessage] = useState(reminder.message);
  const [channel, setChannel] = useState(reminder.channel);
  const [startTime, setStartTime] = useState(new Date(reminder.startTime).toISOString().slice(0, 16));

  const [recurrenceType, setRecurrenceType] = useState(reminder.recurrence.type);
  const [weeklyDays, setWeeklyDays] = useState(reminder.recurrence.type === 'weekly' ? reminder.recurrence.days : []);
  const [intervalHours, setIntervalHours] = useState(reminder.recurrence.type === 'interval' ? reminder.recurrence.hours : 1);

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
      updateReminder({
        id: reminder.id,
        message,
        channel,
        startTime: new Date(startTime).toISOString(),
        recurrence,
      })
    );
    onCancel();
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{ p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
      <Stack spacing={3}>
        <TextField label="メッセージ" value={message} onChange={(e) => setMessage(e.target.value)} required fullWidth variant="filled" />

        <FormControl fullWidth variant="filled">
          <InputLabel id="channel-select-label">チャンネル</InputLabel>
          <Select
            labelId="channel-select-label"
            value={channel}
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
            <InputLabel>曜日</InputLabel>
            <Select
              multiple
              displayEmpty
              value={weeklyDays}
              onChange={(e) => setWeeklyDays(e.target.value as string[])}
              input={<OutlinedInput label="曜日" />}
              renderValue={(selected) => (selected.length === 0 ? <em>曜日を選択...</em> : selected.map((day) => weekDayMap[day]).join(', '))}
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
            variant="filled"
          />
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