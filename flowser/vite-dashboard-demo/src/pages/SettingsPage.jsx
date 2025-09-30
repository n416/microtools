import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Button, TextField, FormControlLabel, Switch } from '@mui/material';
import Header from '../components/Header';

function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [securityMode, setSecurityMode] = useState(false);

  // 初期化時にlocalStorageからデータを読み込む
  useEffect(() => {
    const savedApiKey = localStorage.getItem('geminiApiKey') || '';
    setApiKey(savedApiKey);
    const savedSecurityMode = JSON.parse(localStorage.getItem('securityMode')) || false;
    setSecurityMode(savedSecurityMode);
  }, []);

  // ▼▼▼ 修正: スイッチが変更された瞬間に設定を自動保存するハンドラ ▼▼▼
  const handleSecurityChange = (event) => {
    const newIsChecked = event.target.checked;
    setSecurityMode(newIsChecked);
    localStorage.setItem('securityMode', JSON.stringify(newIsChecked));
  };
  // ▲▲▲ 修正 ▲▲▲

  // APIキー保存用のハンドラ
  const handleSaveSettings = () => {
    localStorage.setItem('geminiApiKey', apiKey);
    //念のためセキュリティモードも一緒に保存
    localStorage.setItem('securityMode', JSON.stringify(securityMode));
    alert('設定を保存しました。');
  };

  // データリセットのハンドラ
  const handleResetData = () => {
    if (window.confirm('保存されている全てのデータをリセットします。よろしいですか？')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ p: '0 24px' }}>
         <Header onResetData={handleResetData} isLocked={false} /> 
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
                    // ▼▼▼ 修正: 新しいハンドラを適用 ▼▼▼
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
        </Paper>
      </Box>
    </Box>
  );
}

export default SettingsPage;