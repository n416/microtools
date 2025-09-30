import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Button, TextField, FormControlLabel, Switch, Divider } from '@mui/material';
import Header from '../components/Header';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [securityMode, setSecurityMode] = useState(false);

  useEffect(() => {
    const savedApiKey = localStorage.getItem('geminiApiKey') || '';
    setApiKey(savedApiKey);
    const savedSecurityMode = JSON.parse(localStorage.getItem('securityMode')) || false;
    setSecurityMode(savedSecurityMode);
  }, []);

  const handleSecurityChange = (event) => {
    const newIsChecked = event.target.checked;
    setSecurityMode(newIsChecked);
    localStorage.setItem('securityMode', JSON.stringify(newIsChecked));
  };

  const handleSaveSettings = () => {
    localStorage.setItem('geminiApiKey', apiKey);
    localStorage.setItem('securityMode', JSON.stringify(securityMode));
    alert('設定を保存しました。');
  };

  const handleResetData = () => {
    if (window.confirm('アプリケーションの全てのデータがリセットされます。この操作は元に戻せません。よろしいですか？')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ p: '0 24px' }}>
        {/* ▼▼▼ 修正: onResetDataを削除 ▼▼▼ */}
        <Header isLocked={false} />
      </Box>

      <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px' }}>
        <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
          <Typography variant="h5" gutterBottom>
            設定
          </Typography>

          <Box sx={{ my: 3 }}>
            <Typography variant="h6" gutterBottom>
              セキュリティ
            </Typography>
            <FormControlLabel
              control={<Switch checked={securityMode} onChange={handleSecurityChange} />}
              label="セキュリティモード"
            />
            <Typography variant="body2" color="text.secondary">
              有効にすると、ブラウザのタブを切り替えるなど、アプリ画面からフォーカスが外れた際に自動で顧客リストがロックされます。デフォルトはOFFです。
            </Typography>
          </Box>

          <Box sx={{ my: 3 }}>
            <Typography variant="h6" gutterBottom>
              API連携
            </Typography>
            <TextField
              label="Gemini API Key"
              variant="outlined"
              fullWidth
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              sx={{ mb: 1 }}
              type="password"
              placeholder="お使いのAPIキーを入力してください"
            />
            <Typography variant="body2" color="text.secondary">
              AIフロー設計機能を利用するために必要です。キーはブラウザ内にのみ保存されます。
            </Typography>
          </Box>

          <Box sx={{ mt: 4, textAlign: 'right' }}>
            <Button variant="contained" color="primary" onClick={handleSaveSettings}>
              設定を保存
            </Button>
          </Box>

          <Divider sx={{ my: 4 }} />

          <Box sx={{ my: 3 }}>
            <Typography variant="h6" gutterBottom color="error">
              データ管理
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              アプリケーション内に保存されている全てのデータ（顧客情報、ワークフロー、設定など）を完全に削除します。この操作は元に戻すことはできません。
            </Typography>
            <Button
              variant="outlined"
              color="error"
              startIcon={<RestartAltIcon />}
              onClick={handleResetData}
            >
              全データをリセット
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

export default SettingsPage;