import React, { useState } from 'react';
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
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset';
import CodeIcon from '@mui/icons-material/Code';
import WorkIcon from '@mui/icons-material/Work';
import GroupIcon from '@mui/icons-material/Group';
import useLocalStorage from '@/hooks/useLocalStorage';
import { Link } from 'react-router-dom';

const ServerIcon = ({ iconName }: { iconName: string }) => {
  switch (iconName) {
    case 'game': return <VideogameAssetIcon />;
    case 'code': return <CodeIcon />;
    case 'work': return <WorkIcon />;
    case 'group': return <GroupIcon />;
    default: return null;
  }
};

interface Server {
  id: string;
  name: string;
  iconName: string;
  isAdded: boolean;
  role: 'admin' | 'member';
}

const mockServers: Server[] = [
  { id: '1', name: 'ゲーム部', iconName: 'game', isAdded: true, role: 'admin' },
  { id: '2', name: '〇〇大学 プログラミングサークル', iconName: 'code', isAdded: false, role: 'member' },
  { id: '3', name: 'プロジェクトAの進捗管理部屋', iconName: 'work', isAdded: true, role: 'admin' },
  { id: '4', name: '個人用テストサーバー', iconName: 'work', isAdded: false, role: 'admin' },
  { id: '5', name: '友人との雑談サーバー', iconName: 'group', isAdded: true, role: 'member' },
  { id: '6', name: 'React勉強会', iconName: 'code', isAdded: true, role: 'member' },
];

interface ServerListSectionProps {
  title: string;
  servers: Server[];
  onSettingsClick: (server: Server) => void;
  onAddClick: (server: Server) => void;
}

const ServerListSection = ({ title, servers, onSettingsClick, onAddClick }: ServerListSectionProps) => (
  <Box>
    <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
      {title}
    </Typography>
    {servers.length > 0 ? (
      <List sx={{ bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
        {servers.map((server, index) => (
          <React.Fragment key={server.id}>
            <ListItem
              secondaryAction={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={server.isAdded ? "導入済み" : "未導入"}
                    color={server.isAdded ? "success" : "default"}
                    size="small"
                  />
                  {server.role === 'admin' && server.isAdded && (
                    <IconButton
                      edge="end"
                      aria-label="settings"
                      onClick={() => onSettingsClick(server)}
                    >
                      <SettingsIcon />
                    </IconButton>
                  )}
                  {server.role === 'admin' && !server.isAdded && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => onAddClick(server)}
                    >
                      導入
                    </Button>
                  )}
                </Stack>
              }
              disablePadding
            >
              <ListItemButton component={Link} to="/" state={{ serverName: server.name, serverIconName: server.iconName }}>
                <ListItemAvatar>
                  <Avatar><ServerIcon iconName={server.iconName} /></Avatar>
                </ListItemAvatar>
                <ListItemText primary={server.name} />
              </ListItemButton>
            </ListItem>
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
  const [showOnlyAdded, setShowOnlyAdded] = useLocalStorage('showOnlyAddedServers', false);
  const [configuringServer, setConfiguringServer] = useState<Server | null>(null);

  const handleOpenSettings = (server: Server) => {
    setConfiguringServer(server);
  };

  const handleCloseSettings = () => {
    setConfiguringServer(null);
  };

  const handleSavePassword = () => {
    console.log(`Saving password for ${configuringServer?.name}`);
    handleCloseSettings();
  };
  
  const handleAddBot = (server: Server) => {
    alert(`「${server.name}」にBotを導入します。\n（これはダミーの動作です）`);
  };

  const filteredByStatus = showOnlyAdded
    ? mockServers.filter(server => server.isAdded)
    : mockServers;

  const adminServers = filteredByStatus.filter(server => server.role === 'admin');
  const memberServers = filteredByStatus.filter(server => server.role === 'member');

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        サーバー一覧
      </Typography>
      <Typography paragraph color="text.secondary">
        あなたが参加しているDiscordサーバーの一覧です。
      </Typography>

      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={<Checkbox checked={showOnlyAdded} onChange={(e) => setShowOnlyAdded(e.target.checked)} />}
          label="導入済みのサーバーのみ表示"
        />
      </Box>
      
      <ServerListSection title="管理サーバー" servers={adminServers} onSettingsClick={handleOpenSettings} onAddClick={handleAddBot} />
      <ServerListSection title="参加サーバー" servers={memberServers} onSettingsClick={handleOpenSettings} onAddClick={handleAddBot} />

      <Dialog open={!!configuringServer} onClose={handleCloseSettings}>
        <DialogTitle>
          「{configuringServer?.name}」のパスワード設定
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            このサーバーのリマインダー設定を保護するためのパスワードを入力してください。
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="password"
            label="新しいパスワード"
            type="password"
            fullWidth
            variant="standard"
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