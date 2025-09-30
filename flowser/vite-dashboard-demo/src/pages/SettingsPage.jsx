import React, { useState, useEffect, useCallback } from 'react';
import { Box, Paper, Typography, Button, TextField, FormControlLabel, Switch, Divider, RadioGroup, Radio, FormLabel, FormControl, Select, MenuItem, InputLabel, CircularProgress } from '@mui/material';
import Header from '../components/Header';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { GeminiApiClient } from '../api/geminiApiClient.js';

function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [securityMode, setSecurityMode] = useState(false);
  const [branchResetBehavior, setBranchResetBehavior] = useState('confirm');
  
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(null);

  const handleTestAndLoadModels = useCallback(async (key) => {
    if (!key) {
      return;
    }
    setIsTesting(true);
    setTestSuccess(null);
    setModels([]);
    try {
      const availableModels = await GeminiApiClient.listAvailableModels(key);
      const supportedModels = availableModels.filter(m => 
        m.supportedGenerationMethods.includes('generateContent')
      );
      setModels(supportedModels);
      setTestSuccess(true);
    } catch (error) {
      console.error('API connection test failed:', error);
      setTestSuccess(false);
      alert(`APIキーの検証に失敗しました: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  }, []);

  useEffect(() => {
    try {
      const savedApiKey = localStorage.getItem('geminiApiKey') || '';
      setApiKey(savedApiKey);

      const securityModeItem = localStorage.getItem('securityMode');
      setSecurityMode(securityModeItem ? JSON.parse(securityModeItem) : false);

      const savedBranchBehavior = localStorage.getItem('branchResetBehavior') || 'confirm';
      setBranchResetBehavior(savedBranchBehavior);

      const savedModel = localStorage.getItem('geminiModelId') || '';
      setSelectedModel(savedModel);

      if (savedApiKey) {
        handleTestAndLoadModels(savedApiKey);
      }

    } catch (error) {
      console.error("localStorageからの設定読み込みに失敗しました:", error);
      setApiKey('');
      setSecurityMode(false);
      setBranchResetBehavior('confirm');
      setSelectedModel('');
    }
  }, [handleTestAndLoadModels]);

  const handleSecurityChange = (event) => {
    const newIsChecked = event.target.checked;
    setSecurityMode(newIsChecked);
    localStorage.setItem('securityMode', JSON.stringify(newIsChecked));
  };

  const handleBranchBehaviorChange = (event) => {
    const newBehavior = event.target.value;
    setBranchResetBehavior(newBehavior);
    localStorage.setItem('branchResetBehavior', newBehavior);
  };
  
  const handleSaveSettings = () => {
    localStorage.setItem('geminiApiKey', apiKey);
    localStorage.setItem('geminiModelId', selectedModel);
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
         <Header isLocked={false} /> 
      </Box>
      
      <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px' }}>
        <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h5" gutterBottom>
                設定
            </Typography>
            <Divider sx={{ my: 2 }} />

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
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ typography: 'h6', color: 'text.primary', mb:1 }}>分岐リセット設定</FormLabel>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    分岐タスクで、一度選んだ選択肢を別のものに選び直した際のサブタスクの進捗の扱いを設定します。
                </Typography>
                <RadioGroup
                  aria-label="branch-reset-behavior"
                  name="branch-reset-behavior-group"
                  value={branchResetBehavior}
                  onChange={handleBranchBehaviorChange}
                >
                  <FormControlLabel value="keep" control={<Radio />} label="進捗を保持する（他の選択肢の進捗はクリアされません）" />
                  <FormControlLabel value="confirm" control={<Radio />} label="毎回確認する（推奨）" />
                  <FormControlLabel value="clear" control={<Radio />} label="自動でリセットする（以前の進捗は自動でクリアされます）" />
                </RadioGroup>
              </FormControl>
            </Box>


            <Box sx={{ my: 3 }}>
                <Typography variant="h6" gutterBottom>API連携</Typography>
                <TextField label="Gemini API Key" variant="outlined" fullWidth value={apiKey} onChange={(e) => setApiKey(e.target.value)} sx={{ mb: 1 }} type="password" placeholder="お使いのAPIキーを入力してください"/>
                 <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    AIフロー設計機能などを利用するために必要です。キーはブラウザ内にのみ保存されます。
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Button variant="outlined" onClick={() => handleTestAndLoadModels(apiKey)} disabled={isTesting}>
                        {isTesting ? <CircularProgress size={24} /> : '接続テスト & モデル読込'}
                    </Button>
                    {testSuccess === true && <Typography color="green">✅ 接続成功</Typography>}
                    {testSuccess === false && <Typography color="error">❌ 接続失敗</Typography>}
                </Box>
                
                <FormControl fullWidth>
                    <InputLabel id="model-select-label">使用するAIモデル</InputLabel>
                    <Select
                        labelId="model-select-label"
                        id="model-select"
                        value={selectedModel}
                        label="使用するAIモデル"
                        onChange={(e) => setSelectedModel(e.target.value)}
                    >
                        {models.map((model) => (
                            <MenuItem key={model.name} value={model.name}>
                                {model.displayName} ({model.name.replace('models/', '')})
                            </MenuItem>
                        ))}
                    </Select>
                     <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        接続テスト後に利用可能なモデルが表示されます。AI機能で利用したいモデルを選択してください。
                    </Typography>
                </FormControl>
            </Box>
            
            <Box sx={{ mt: 4, textAlign: 'right' }}>
                <Button variant="contained" color="primary" onClick={handleSaveSettings}>
                    設定を保存
                </Button>
            </Box>

            <Divider sx={{ my: 4 }} />

            <Box sx={{ my: 3 }}>
                <Typography variant="h6" gutterBottom color="error">データ管理</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    アプリケーション内に保存されている全てのデータ（顧客情報、ワークフロー、設定など）を完全に削除します。この操作は元に戻すことはできません。
                </Typography>
                <Button variant="outlined" color="error" startIcon={<RestartAltIcon />} onClick={handleResetData}>
                    全データをリセット
                </Button>
            </Box>
        </Paper>
      </Box>
    </Box>
  );
}

export default SettingsPage;