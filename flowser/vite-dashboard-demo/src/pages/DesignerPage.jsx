import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Box, ToggleButtonGroup, ToggleButton, Button, TextField, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemText, Typography, Fab, Paper } from '@mui/material';
import Header from '../components/Header';
import PhaseHierarchyPane from '../components/PhaseHierarchyPane';
import KnowledgeListPane from '../components/KnowledgeListPane';
import KnowledgeEditorPane from '../components/KnowledgeEditorPane';
import FlowGeneratorModal from '../components/FlowGeneratorModal';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import EditNoteIcon from '@mui/icons-material/EditNote';
import FolderCopyIcon from '@mui/icons-material/FolderCopy';
import GavelIcon from '@mui/icons-material/Gavel';
import RuleEditingPane from '../components/RuleEditingPane';
import { GeminiApiClient } from '../api/geminiApiClient.js';
import { addFlow } from '../store/caseSlice';
import { v4 as uuidv4 } from 'uuid';
import FlowManagementPane from '../components/FlowManagementPane.jsx';
import FlowDesignPane from '../components/FlowDesignPane.jsx';
import KnowledgeSetupAssistant from '../components/KnowledgeSetupAssistant.jsx'; 
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';


function AiSetupAssistantWelcomePanel({ onStart }) {
  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, gap: 2, width: '100%' }}>
      <AutoFixHighIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
      <Typography variant="h5" component="h2" gutterBottom>
        AIとの対話で、あなたの業務知識を整理しませんか？
      </Typography>
      <Typography color="text.secondary" align="center" sx={{ maxWidth: '600px', mb: 2 }}>
        最初のステップとして、AIアシスタントがあなたの業界や主な業務について簡単な質問をします。
        回答をもとに、業務フロー設計の土台となる「知識ライブラリ」を自動で構築します。
      </Typography>
      <Button variant="contained" size="large" onClick={onStart}>
        ガイド付きセットアップを開始する
      </Button>
    </Paper>
  );
}


function PhaseSelectionModal({ open, onClose, phases, onSelect }) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>起点フェーズの選択</DialogTitle>
      <DialogContent>
        <Typography gutterBottom>
          これから作成するフローが、どの業務フェーズに主に関連しているかを選択してください。
        </Typography>
        <List>
          {phases.map(phase => (
            <ListItemButton key={phase.id} onClick={() => onSelect(phase.id)}>
              <ListItemText primary={phase.name} />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
      </DialogActions>
    </Dialog>
  );
}


function DesignerPage() {
  const dispatch = useDispatch();
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [isAssistantModalOpen, setIsAssistantModalOpen] = useState(false);
  const [mode, setMode] = useState('knowledge');

  const { library: knowledgeLibrary } = useSelector(state => state.knowledge);
  const [chatHistory, setChatHistory] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isWaitingForUserInput, setIsWaitingForUserInput] = useState(false);
  const [isWaitingForAiResponse, setIsWaitingForAiResponse] = useState(false);

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [flowName, setFlowName] = useState('');

  const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false);
  const [selectedMainPhaseId, setSelectedMainPhaseId] = useState(null);

  const isAiChatActive = selectedMainPhaseId !== null;
  
  const isKnowledgeSetupDone = knowledgeLibrary && knowledgeLibrary.length > 0;

  useEffect(() => {
    if (selectedMainPhaseId && chatHistory.length === 0) {
      const phaseName = knowledgeLibrary.find(p => p.id === selectedMainPhaseId)?.name || '選択されたフェーズ';
      setChatHistory([{
        sender: 'ai',
        text: `こんにちは！「${phaseName}」に関する業務フローを設計しますね。どのようなフローを作成しますか？`,
      }]);
      setNodes([]);
      setEdges([]);
      setIsWaitingForUserInput(true);
      setIsWaitingForAiResponse(false);
    }
  }, [selectedMainPhaseId, chatHistory.length, knowledgeLibrary]);

  const findKnowledgeById = useCallback((id) => {
    for (const phase of knowledgeLibrary) {
        const directKnowledge = (phase.knowledges || []).find(k => k.id === id);
        if (directKnowledge) return { knowledge: directKnowledge, phaseId: phase.id, phaseName: phase.name };

        for (const subPhase of phase.subPhases || []) {
            const subKnowledge = (subPhase.knowledges || []).find(k => k.id === id);
            if (subKnowledge) return { knowledge: subKnowledge, phaseId: phase.id, phaseName: phase.name };
        }
    }
    return null;
  }, [knowledgeLibrary]);

  const generatePrompt = (userMessage) => {
    const mainPhase = knowledgeLibrary.find(p => p.id === selectedMainPhaseId);

    const systemPrompt = `あなたは優秀な業務コンサルタントです。ユーザーの指示に基づき、提示された知識ライブラリの項目だけを使って対話的に業務フローを構築します。

# 知識ライブラリ (全フェーズ)
${JSON.stringify(knowledgeLibrary, null, 2)}

# あなたの思考プロセス (このセクションを厳密に守ってください)
1.  **ユーザー指示の解釈**: ユーザーが何をしたいか分析する。どの知識項目(knowledgeId)について言及しているか特定する。
2.  **逸脱チェック**:
    a.  追加または言及された知識項目のIDを基に、それが属するフェーズを知識ライブラリから特定する。
    b.  現在の起点フェーズは「${mainPhase?.name}」(ID: ${mainPhase?.id}) である。
    c.  特定したタスクのフェーズは、起点フェーズと一致するか？
    d.  一致しない場合、これは「逸脱」である。応答には **必ず [WARNING] 接頭辞を付ける必要がある** と結論付ける。
3.  **アクションプラン**: 思考プロセスに基づき、フローチャートを更新するためのJSONアクション（ADD, DELETE, UPDATE）を計画する。
4.  **応答メッセージ作成**: 思考プロセスに基づき、ユーザーへの返答メッセージを作成する。逸脱チェックで警告が必要と判断した場合、必ずメッセージの先頭に [WARNING] を付ける。

# 逸脱に関する【最重要】ルール
- **逸脱の定義**: あなたが提案、またはユーザーの指示で追加するタスクが、思考プロセスで確認した結果、起点フェーズである「${mainPhase?.name}」に属していない場合は、すべて「逸脱」とみなします。例外はありません。
- **警告の義務**: あなたの提案が「逸脱」の定義に当てはまる場合、思考プロセスに従い、**必ず応答メッセージの先頭に [WARNING] という接頭辞を付けてください。**

# フローチャートのレイアウトに関するルール
- フローは上から下へ流れるように構築する。
- 新しいノードを追加する場合、接続元のノードよりもY座標が必ず大きくなるように position を設定する (例: y: 元のy + 80)。
- ノードが重ならないようにX座標を調整する。

# 現在のフローの状態
- ノード: ${JSON.stringify(nodes, null, 2)}
- エッジ: ${JSON.stringify(edges, null, 2)}
- ユーザーの最新の指示: "${userMessage}"

# 出力JSONフォーマット (思考プロセスに基づき、以下の形式で出力してください)
[
  {
    "action": "ADD" | "DELETE" | "UPDATE",
    "newNode": { "knowledgeId": "k-001", "position": { "x": 250, "y": 50 } },
    "newEdge": { "source": "k-001", "target": "k-002" },
    "deleteNodeId": "k-007",
    "updateEdge": { "source": "k-006", "target": "k-008" },
    "aiResponse": {
      "text": "ユーザーへの返答メッセージ",
      "options": [ { "label": "選択肢テキスト", "value": "choice_value" } ]
    }
  }
]
`;
    return systemPrompt;
  }

  const handleSendMessage = async (message) => {
    const newUserMessage = { sender: 'user', text: message };
    setChatHistory(prev => [...prev, newUserMessage]);
    setIsWaitingForUserInput(false);
    setIsWaitingForAiResponse(true);

    try {
      const gemini = new GeminiApiClient();
      if (!gemini.isAvailable) throw new Error('Gemini APIキーまたはモデルIDが設定されていません。');

      const prompt = generatePrompt(message);
      const resultText = await gemini.generateContent(prompt);

      const cleanedJson = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      const aiResponseArray = JSON.parse(cleanedJson);

      let lastAiResponse = null;

      aiResponseArray.forEach(responseObject => {
        const { action, newNode, newEdge, deleteNodeId, updateEdge, aiResponse } = responseObject;

        if (action === 'DELETE' && deleteNodeId) {
          setNodes(prev => prev.filter(node => node.id !== deleteNodeId));
          setEdges(prev => prev.filter(edge => edge.source !== deleteNodeId && edge.target !== deleteNodeId));
        }

        if (action === 'UPDATE' && updateEdge) {
          setEdges(prev => prev.map(edge =>
            (edge.source === updateEdge.source || edge.target === updateEdge.target)
              ? { ...edge, target: updateEdge.target }
              : edge
          ));
        }

        if (action === 'ADD') {
          if (newNode && newNode.knowledgeId) {
            const found = findKnowledgeById(newNode.knowledgeId);
            if (found) {
              setNodes(prev => [...prev, {
                id: found.knowledge.id, position: newNode.position, data: { label: found.knowledge.text }
              }]);
            }
          }
          if (newEdge && newEdge.source && newEdge.target) {
            setEdges(prev => [...prev, {
              id: `e-${newEdge.source}-${newEdge.target}-${uuidv4()}`,
              source: newEdge.source, target: newEdge.target, animated: true,
            }]);
          }
        }

        if (aiResponse) {
          lastAiResponse = { sender: 'ai', ...aiResponse };
        }
      });

      if (lastAiResponse) {
        setChatHistory(prev => [...prev, lastAiResponse]);
      }

    } catch (error) {
      console.error('AI response handling failed:', error);
      const errorMessage = { sender: 'ai', text: `エラーが発生しました: ${error.message}` };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsWaitingForUserInput(true);
      setIsWaitingForAiResponse(false);
    }
  };

  const handleSaveFlow = () => {
    if (!flowName.trim()) {
      alert('フロー名を入力してください。');
      return;
    }
    const newTasks = nodes.map(node => {
      const found = findKnowledgeById(node.id);
      const knowledge = found ? found.knowledge : null;
      return {
        id: uuidv4(),
        text: knowledge?.text || '不明なタスク',
        details: knowledge?.details || '',
        refId: knowledge?.id,
        type: knowledge?.type || 'task',
        options: knowledge?.options || [],
        completed: false,
        memo: '',
      };
    });

    const newFlow = {
      id: `flow-${uuidv4()}`,
      name: flowName,
      description: 'AIチャット設計機能で作成されました。',
      tasks: newTasks,
    };

    dispatch(addFlow(newFlow));
    alert(`新しいフロー「${flowName}」を保存しました。`);
    setIsSaveModalOpen(false);
    setFlowName('');
  };

  const handleModeChange = (event, newMode) => {
    if (newMode !== null) {
      setMode(newMode);
    }
  };

  const handleStartAiDesign = () => {
    setIsPhaseModalOpen(true);
  };

  const handlePhaseSelected = (phaseId) => {
    setSelectedMainPhaseId(phaseId);
    setChatHistory([]);
    setNodes([]);
    setEdges([]);
    setIsPhaseModalOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ p: '0 24px' }}>
        <Header isLocked={false} />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', p: '0 24px 16px' }}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          aria-label="designer mode"
        >
          <ToggleButton value="knowledge" aria-label="knowledge editing mode">
            <EditNoteIcon sx={{ mr: 1 }} />
            知識編集
          </ToggleButton>
          <ToggleButton value="flow-management" aria-label="flow management mode">
            <FolderCopyIcon sx={{ mr: 1 }} />
            フロー編集
          </ToggleButton>
          <ToggleButton value="rule-editing" aria-label="rule editing mode">
            <GavelIcon sx={{ mr: 1 }} />
            ルール編集
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {mode === 'knowledge' && (
        <>
          {!isKnowledgeSetupDone ? (
            <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', display: 'flex' }}>
               <AiSetupAssistantWelcomePanel onStart={() => setIsAssistantModalOpen(true)} />
            </Box>
          ) : (
            <DndProvider backend={HTML5Backend}>
              <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', display: 'flex', gap: 2, minHeight: 0 }}>
                <Box sx={{ flex: '0 1 320px', minWidth: 280 }}><PhaseHierarchyPane /></Box>
                <Box sx={{ flex: '1 1 40%', minWidth: 300 }}><KnowledgeListPane onOpenAiModal={() => setIsGeneratorModalOpen(true)} /></Box>
                <Box sx={{ flex: '1 1 60%', minWidth: 400 }}><KnowledgeEditorPane /></Box>
              </Box>
            </DndProvider>
          )}
        </>
      )}

      {mode === 'flow-management' && (
        <DndProvider backend={HTML5Backend}>
          <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', display: 'flex', gap: 2, minHeight: 0 }}>
            <Box sx={{ flex: '0 1 400px', minWidth: 320 }}>
              <FlowManagementPane onStartAiDesign={handleStartAiDesign} />
            </Box>
            <Box sx={{ flex: '1 1 60%', minWidth: 500 }}>
              <FlowDesignPane
                isActive={isAiChatActive}
                chatHistory={chatHistory}
                nodes={nodes}
                edges={edges}
                onSendMessage={handleSendMessage}
                isWaitingForUserInput={isWaitingForUserInput}
                isWaitingForAiResponse={isWaitingForAiResponse}
                onSave={() => setIsSaveModalOpen(true)}
              />
            </Box>
          </Box>
        </DndProvider>
      )}

      {mode === 'rule-editing' && (
        <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', minHeight: 0 }}>
          <RuleEditingPane />
        </Box>
      )}
      
      {isKnowledgeSetupDone && mode === 'knowledge' && (
          <Fab
            color="primary"
            aria-label="ai-assistant"
            sx={{ position: 'absolute', bottom: 40, right: 40 }}
            onClick={() => setIsAssistantModalOpen(true)}
          >
            <AutoFixHighIcon />
          </Fab>
      )}

      <FlowGeneratorModal open={isGeneratorModalOpen} onClose={() => setIsGeneratorModalOpen(false)} />

      <Dialog open={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)}>
        <DialogTitle>新しいフローとして保存</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="フロー名"
            type="text"
            fullWidth
            variant="standard"
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsSaveModalOpen(false)}>キャンセル</Button>
          <Button onClick={handleSaveFlow}>保存</Button>
        </DialogActions>
      </Dialog>

      <PhaseSelectionModal
        open={isPhaseModalOpen}
        onClose={() => setIsPhaseModalOpen(false)}
        phases={knowledgeLibrary.filter(p => (p && p.subPhases && p.subPhases.length > 0) || (p && p.knowledges && p.knowledges.length > 0))}
        onSelect={handlePhaseSelected}
      />

      <KnowledgeSetupAssistant
        open={isAssistantModalOpen}
        onClose={() => setIsAssistantModalOpen(false)}
        isInitialSetup={!isKnowledgeSetupDone}
      />
    </Box>
  );
}

export default DesignerPage;