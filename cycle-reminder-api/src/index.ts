import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';
import authRouter from './routes/auth';
import remindersRouter from './routes/reminders';
import serversRouter from './routes/servers';
import logsRouter from './routes/logs';
// channelsRouterはserversRouterに統合されるため、ここでのインポートは不要

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

export const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Bot logged in as ${client.user?.tag}!`);
});

client.login(process.env.DISCORD_BOT_TOKEN);

app.use(cors());
app.use(express.json());

app.use('/api', (req, res, next) => {
  // console.log(`[Request Logger] Path: ${req.path}, Method: ${req.method}`);
  next();
});

app.get('/', (req, res) => {
  res.send('Cycle Reminder API is running!');
});

app.use('/api/auth', authRouter);
app.use('/api/reminders', remindersRouter);
// --- ★★★ ここを修正 ★★★ ---
// channelsRouterはserversRouterの内部で処理されるため、登録はserversRouterのみでOK
app.use('/api/servers', serversRouter);
// --- ★★★ ここまで修正 ★★★ ---

app.use('/api/logs', logsRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});