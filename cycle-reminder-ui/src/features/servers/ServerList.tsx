import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Divider,
  FormControlLabel,
  Checkbox,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  TextField,
  DialogActions,
  Button,
  CircularProgress,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddLinkIcon from '@mui/icons-material/AddLink';
import useLocalStorage from '@/hooks/useLocalStorage';
import { Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { fetchServers, selectAllServers, getServersStatus, getLastFetched, Server, updateServerPassword } from './serversSlice';
import { showToast } from '@/features/toast/toastSlice';

const OAUTH_URL = `https://discord.com/api/oauth2/authorize?client_id=${import.meta.env.VITE_DISCORD_CLIENT_ID}&permissions=268435456&scope=bot%20applications.commands`;

const getServerIconUrl = (id: string, iconHash: string | null) => {
  if (!iconHash) return null;
  return `https://cdn.discordapp.com/icons/${id}/${iconHash}.png`;
};

interface ServerListSectionProps {
  title: string;
  servers: Server[];
  onSettingsClick: (server: Server) => void;
}

const ServerListSection = ({ title, servers, onSettingsClick }: ServerListSectionProps) => (
  <Box>
    <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
      {title}
    </Typography>
    {servers.length > 0 ? (
      <List sx={{ bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1, p: 0 }}>
        {servers.map((server: Server, index: number) => (
          <React.Fragment key={server.id}>
            {/* --- ★★★ ここからListItemの構造を全面的に修正 ★★★ --- */}
            <ListItem disablePadding>
              <Box sx={{ width: '100%', p: 1, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center' }}>
                
                {/* 1段目: アイコンとサーバー名 (リンク付き) */}
                <ListItemButton component={Link} to={`/servers/${server.id}`} sx={{ flexGrow: 1, p: 1, borderRadius: 1 }}>
                  <ListItemAvatar>
                    <Avatar src={getServerIconUrl(server.id, server.icon) || undefined}>
                      {server.name.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={server.name} />
                </ListItemButton>

                {/* 2段目: 導入状況とボタン */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: { xs: 1, sm: 0 }, pl: { xs: 0, sm: 2 } }}>
                  <Chip
                    label={server.isAdded ? "導入済み" : "未導入"}
                    color={server.isAdded ? "success" : "default"}
                    size="small"
                  />
                  {server.role === 'admin' && server.isAdded && (
                    <IconButton edge="end" aria-label="settings" onClick={() => onSettingsClick(server)}>
                      <SettingsIcon />
                    </IconButton>
                  )}
                  {server.role === 'admin' && !server.isAdded && (
                    <Button
                      variant="outlined"
                      size="small"
                      href={`${OAUTH_URL}&guild_id=${server.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      startIcon={<AddLinkIcon />}
                    >
                      導入
                    </Button>
                  )}
                </Stack>

              </Box>
            </ListItem>
            {/* --- ★★★ ここまで修正 ★★★ --- */}
            {index < servers.length - 1 && <Divider component="li" />}
          </React.Fragment>
        ))}
      </List>
    ) : (
      <Typography color="text.secondary">対象のサーバーはありません。</Typography>
    )}
  </Box>
);


export const ServerList = () => {
  const dispatch = useAppDispatch();
  const servers = useAppSelector(selectAllServers);
  const serversStatus = useAppSelector(getServersStatus);
  const lastFetched = useAppSelector(getLastFetched);
  const error = useAppSelector(state => state.servers.error);
  
  const [showOnlyAdded, setShowOnlyAdded] = useLocalStorage('showOnlyAddedServers', false);
  const [configuringServer, setConfiguringServer] = useState<Server | null>(null);
  
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const CACHE_DURATION = 5 * 60 * 1000;
    const now = Date.now();
    if (serversStatus !== 'loading') {
      if (!lastFetched || (now - lastFetched > CACHE_DURATION)) {
        dispatch(fetchServers());
      }
    }
  }, [dispatch, lastFetched, serversStatus]);
  
  const handleRefresh = () => {
    dispatch(fetchServers());
  };

  const filteredByAdded = showOnlyAdded
    ? servers.filter(server => server.isAdded)
    : servers;
  
  const adminServers = filteredByAdded.filter(server => server.role === 'admin');
  const memberServers = filteredByAdded.filter(server => server.role === 'member');

  const handleOpenSettings = (server: Server) => setConfiguringServer(server);
  const handleCloseSettings = () => {
    setConfiguringServer(null);
    setNewPassword('');
  };

  const handleSavePassword = async () => {
    if (!configuringServer) return;
    try {
      await dispatch(updateServerPassword({ serverId: configuringServer.id, password: newPassword })).unwrap();
      dispatch(showToast({ message: 'パスワードを更新しました。', severity: 'success' }));
    } catch (err) {
      dispatch(showToast({ message: 'パスワードの更新に失敗しました。', severity: 'error' }));
    } finally {
      handleCloseSettings();
    }
  };
  
  let content;
  if (serversStatus === 'loading' && servers.length === 0) {
    content = <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  } else if (serversStatus === 'failed') {
    content = <Typography color="error">エラー: {error}</Typography>;
  } else if (servers.length > 0) {
    content = (
      <>
        <ServerListSection title="管理サーバー" servers={adminServers} onSettingsClick={handleOpenSettings} />
        <ServerListSection title="参加サーバー" servers={memberServers} onSettingsClick={handleOpenSettings} />
      </>
    );
  } else if (serversStatus === 'succeeded' && servers.length === 0) {
    content = <Typography sx={{ mt: 4, textAlign: 'center' }}>参加しているDiscordサーバーが見つかりませんでした。</Typography>;
  } else {
    content = <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h5" gutterBottom sx={{ mb: 0 }}>
          サーバー一覧
        </Typography>
        <IconButton onClick={handleRefresh} disabled={serversStatus === 'loading'}>
          <RefreshIcon />
        </IconButton>
      </Stack>
      <Typography paragraph color="text.secondary">
        あなたが参加しているDiscordサーバーの一覧です。
      </Typography>

      <Box sx={{ mb: 2 }}>
        <FormControlLabel 
          control={<Checkbox checked={showOnlyAdded} onChange={(e) => setShowOnlyAdded(e.target.checked)} />} 
          label="導入済みのサーバーのみ表示" 
        />
      </Box>
      
      {content}

      <Dialog open={!!configuringServer} onClose={handleCloseSettings}>
        <DialogTitle>
          「{configuringServer?.name}」のパスワード設定
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            このサーバーのリマインダー設定を保護するためのパスワードを入力してください。空欄で保存するとパスワードが削除されます。
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="新しいパスワード"
            type="password"
            fullWidth
            variant="standard"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSavePassword()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSettings}>キャンセル</Button>
          <Button onClick={handleSavePassword} variant="contained">保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};