import React, { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, Button, TextField } from '@mui/material';
import Header from '../components/Header';
import { GeminiApiClient } from '../api/geminiApiClient.js';

function FlowDesignerPage() {
  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [newKnowledgeText, setNewKnowledgeText] = useState('');
  const [instruction, setInstruction] = useState('');
  const [generatedTasks, setGeneratedTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');

  // 初期化時にlocalStorageから知識ベースを読み込む
  useEffect(() => {
    const savedKnowledge = JSON.parse(localStorage.getItem('knowledgeBase')) || [];
    setKnowledgeBase(savedKnowledge);
  }, []);

  // 新しい知識を登録するハンドラ
  const handleAddKnowledge = () => {
    if (newKnowledgeText.trim()) {
        const newIdNumber = knowledgeBase.length > 0 ? Math.max(...knowledgeBase.map(item => parseInt(item.id.substring(1)))) + 1 : 1;
        const newKnowledge = { id: `K${String(newIdNumber).padStart(3, '0')}`, text: newKnowledgeText.trim() };
        const updatedKnowledgeBase = [...knowledgeBase, newKnowledge];
        setKnowledgeBase(updatedKnowledgeBase);
        localStorage.setItem('knowledgeBase', JSON.stringify(updatedKnowledgeBase));
        setNewKnowledgeText('');
    }
  };

  // フローを生成するハンドラ
  const handleGenerateFlow = async () => {
    if (!instruction.trim() || knowledgeBase.length === 0) {
        alert('「知識ベース」と「AIへの指示」の両方を入力してください。');
        return;
    }
    setIsLoading(true);
    setGeneratedTasks([]);

    try {
        const gemini = new GeminiApiClient();
        if (!gemini.isAvailable) {
            throw new Error('APIキーが未設定です。右上の設定アイコンからAPIキーを登録してください。');
        }
        const knowledgeText = knowledgeBase.map(k => `${k.id}: ${k.text}`).join('\n');
        const prompt = `あなたは優秀な業務コンサルタントです。以下の【知識リスト】を制約条件として厳守し、ユーザーからの【指示】に合致する業務フローを、論理的に矛盾のないステップ・バイ・ステップのリスト形式で提案してください。各ステップがどの知識に基づいているか、IDを明記してください。\n\n【知識リスト】\n${knowledgeText}\n\n【指示】\n${instruction}\n\n【出力形式】\n- (タスク内容1) (根拠: KXXX)\n- (タスク内容2) (根拠: KXXX)\n- (AIが補完したタスク内容)`;
        
        const modelName = 'gemini-pro'; 
        const resultText = await gemini.generateContent(prompt, modelName);
        
        const tasks = resultText.split('\n').filter(line => line.trim().startsWith('-')).map((line, index) => {
            const match = line.match(/- (.+?) \(根拠: (K\d+)\)/);
            return {
                id: index + 1,
                text: match ? match[1].trim() : line.replace('-', '').trim(),
                refId: match ? match[2].trim() : 'AI',
                completed: false,
                details: '',
            };
        });
        setGeneratedTasks(tasks);
    } catch (error) {
        console.error('API呼び出し中にエラーが発生しました:', error);
        alert(`エラー: ${error.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  // 生成されたフローを保存するハンドラ
  const handleSaveFlow = () => {
    if (!newFlowName.trim()) {
        alert('フロー名を入力してください。');
        return;
    }
    if (generatedTasks.length === 0) {
        alert('保存するタスクがありません。');
        return;
    }
    const library = JSON.parse(localStorage.getItem('workflowLibrary')) || [];
    const newFlow = {
        id: `wf${Date.now()}`,
        name: newFlowName.trim(),
        description: `AIによって「${instruction.substring(0, 20)}...」という指示を元に生成されました。`,
        tasks: generatedTasks
    };
    library.push(newFlow);
    localStorage.setItem('workflowLibrary', JSON.stringify(library));
    alert('新しいフローが保存されました！顧客管理画面で利用できます。');
    setNewFlowName('');
    setInstruction('');
    setGeneratedTasks([]);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ p: '0 24px' }}>
         {/* ▼▼▼ 修正: isLocked={false} を追加し、onResetDataを削除 ▼▼▼ */}
         <Header isLocked={false} /> 
      </Box>
      
      <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', display: 'flex', gap: 2, minHeight: 0 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>① 知識ベース</Typography>
              <TextField
                label="新しい知識"
                multiline
                rows={4}
                variant="outlined"
                fullWidth
                value={newKnowledgeText}
                onChange={(e) => setNewKnowledgeText(e.target.value)}
                placeholder="例: 普通自動車の契約には印鑑証明書が必要"
                sx={{ mb: 1 }}
              />
              <Button variant="contained" onClick={handleAddKnowledge} sx={{ mb: 2 }}>知識を登録</Button>
              <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
                {knowledgeBase.map(item => (
                    <Paper key={item.id} variant="outlined" sx={{ p: 1, mb: 1 }}>
                       <Typography variant="caption">{item.id}</Typography>
                       <Typography variant="body2">{item.text}</Typography>
                    </Paper>
                ))}
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={7}>
             <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
               <Typography variant="h6" gutterBottom>② フロー生成</Typography>
               <TextField
                label="AIへの指示"
                multiline
                rows={4}
                variant="outlined"
                fullWidth
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="例: 軽自動車の新規契約で、値引き交渉があった場合のフロー"
                sx={{ mb: 1 }}
               />
               <Button variant="contained" color="primary" onClick={handleGenerateFlow} disabled={isLoading}>
                {isLoading ? '生成中...' : 'フローを生成'}
               </Button>
               <Box sx={{ overflow: 'auto', flexGrow: 1, my: 2, p:1, border: '1px solid #eee', borderRadius: 1 }}>
                {generatedTasks.map(task => (
                    <Paper key={task.id} variant="outlined" sx={{ p: 1, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{bgcolor: 'grey.200', p: '2px 8px', borderRadius: '12px'}}>{task.refId}</Typography>
                        <Typography variant="body2">{task.text}</Typography>
                    </Paper>
                ))}
               </Box>
               <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                        label="新しいフロー名"
                        variant="outlined"
                        fullWidth
                        value={newFlowName}
                        onChange={(e) => setNewFlowName(e.target.value)}
                    />
                    <Button variant="contained" color="success" onClick={handleSaveFlow}>
                        このフローを保存
                    </Button>
               </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

export default FlowDesignerPage;