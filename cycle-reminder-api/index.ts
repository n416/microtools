import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';
import authRouter from './routes/auth';
import remindersRouter from './routes/reminders';
import serversRouter from './routes/servers';
import logsRouter from './routes/logs';
import channelsRouter from './routes/channels'; // 1. channels.tsをインポート

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

app.get('/', (req, res) => {
  res.send('Cycle Reminder API is running!');
});

app.use('/api/auth', authRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/servers', serversRouter);
app.use('/api/logs', logsRouter);
app.use('/api/servers', channelsRouter); // 2. /api/servers というパスで有効化

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});