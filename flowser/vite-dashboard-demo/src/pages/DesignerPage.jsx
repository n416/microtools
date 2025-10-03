import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux'; // <- "redux-react" から "react-redux" に修正
import { Box, ToggleButtonGroup, ToggleButton, Button, TextField, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import Header from '../components/Header';
import PhaseHierarchyPane from '../components/PhaseHierarchyPane';
import KnowledgeListPane from '../components/KnowledgeListPane';
import KnowledgeEditorPane from '../components/KnowledgeEditorPane';
import FlowGeneratorModal from '../components/FlowGeneratorModal';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import CategoryManagementPane from '../components/CategoryManagementPane';
import FlowListPane from '../components/FlowListPane';
import EditNoteIcon from '@mui/icons-material/EditNote';
import FolderCopyIcon from '@mui/icons-material/FolderCopy';
import MarkUnreadChatAltIcon from '@mui/icons-material/MarkUnreadChatAlt';
import AiChatView from '../components/AiChatView';
import { GeminiApiClient } from '../api/geminiApiClient.js';
import { addFlow } from '../store/caseSlice';
import { v4 as uuidv4 } from 'uuid';

function DesignerPage() {
  const dispatch = useDispatch();
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [mode, setMode] = useState('knowledge'); // 'knowledge', 'flow-management', 'flow-ai-chat'

  const { library: knowledgeLibrary } = useSelector(state => state.knowledge);
  const [chatHistory, setChatHistory] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isWaitingForUserInput, setIsWaitingForUserInput] = useState(true);
  const [isWaitingForAiResponse, setIsWaitingForAiResponse] = useState(false);

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [flowName, setFlowName] = useState('');

  useEffect(() => {
    if (mode === 'flow-ai-chat' && chatHistory.length === 0) {
      setChatHistory([{
        sender: 'ai',
        text: 'こんにちは！どのような業務フローを設計しますか？\n例：「新車販売のフローを開始」',
      }]);
      setNodes([]);
      setEdges([]);
      setIsWaitingForUserInput(true);
      setIsWaitingForAiResponse(false);
    }
  }, [mode, chatHistory.length]);

  const findKnowledgeById = useCallback((id) => {
    for (const phase of knowledgeLibrary) {
      const directKnowledge = phase.knowledges?.find(k => k.id === id);
      if (directKnowledge) return directKnowledge;
      for (const subPhase of phase.subPhases) {
        const subKnowledge = subPhase.knowledges?.find(k => k.id === id);
        if (subKnowledge) return subKnowledge;
      }
    }
    return null;
  }, [knowledgeLibrary]);

  const generatePrompt = (userMessage) => {
    const systemPrompt = `あなたは優秀な業務コンサルタントです。ユーザーの指示に基づき、提示された知識ライブラリの項目だけを使って対話的に業務フローを構築します。

# あなたの思考プロセスとルール
1.  ユーザーの指示を理解します。「削除」「変更」「繋ぎ変え」といった指示にも対応してください。
2.  指示に従って、フローチャートを更新するためのアクション（追加、削除、変更）を決定します。
3.  **削除の場合の重要ルール：** ユーザーからノードの削除指示があった場合、そのノードを削除するだけでなく、**フローが途切れないように、削除されたノードの前後のノードを新しいエッジで再接続してください。**
4.  **宣言と実行の一致：** あなたがユーザーへの返答メッセージ（aiResponse.text）で述べた計画（追加、削除、変更）は、**必ず同じJSON応答に含めなければなりません。**
5.  返答は、必ず以下のJSON形式の配列で出力してください。

# 知識ライブラリ
${JSON.stringify(knowledgeLibrary, null, 2)}

# 現在のフローの状態
- ノード: ${JSON.stringify(nodes, null, 2)}
- エッジ: ${JSON.stringify(edges, null, 2)}

# ユーザーの最新の指示
"${userMessage}"

# 出力JSONフォーマット (配列形式)
[
  {
    "action": "ADD" | "DELETE" | "UPDATE",
    "newNode": { "knowledgeId": "k-001", "position": { "x": 250, "y": 50 } },
    "newEdge": { "source": "k-001", "target": "k-002" },
    "deleteNodeId": "k-007",
    "updateEdge": { "source": "k-006", "target": "k-008" },
    "aiResponse": {
      "text": "ユーザーへの返答メッセージ",
      "options": []
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
                const knowledge = findKnowledgeById(newNode.knowledgeId);
                if (knowledge) {
                    setNodes(prev => [...prev, {
                        id: knowledge.id, position: newNode.position, data: { label: knowledge.text }
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
      
      if(lastAiResponse) {
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
      const knowledge = findKnowledgeById(node.id);
      return {
        id: uuidv4(),
        text: knowledge?.text || '不明なタスク',
        details: knowledge?.details || '',
        refId: knowledge?.id,
        type: knowledge?.type || 'task',
        options: knowledge?.options,
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
            フロー管理
          </ToggleButton>
          <ToggleButton value="flow-ai-chat" aria-label="ai chat design mode">
            <MarkUnreadChatAltIcon sx={{ mr: 1 }} />
            AIフロー設計
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {mode === 'knowledge' && (
        <DndProvider backend={HTML5Backend}>
          <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', display: 'flex', gap: 2, minHeight: 0 }}>
            <Box sx={{ flex: '0 1 320px', minWidth: 280 }}><PhaseHierarchyPane /></Box>
            <Box sx={{ flex: '1 1 40%', minWidth: 300 }}><KnowledgeListPane onOpenAiModal={() => setIsAiModalOpen(true)} /></Box>
            <Box sx={{ flex: '1 1 60%', minWidth: 400 }}><KnowledgeEditorPane /></Box>
          </Box>
        </DndProvider>
      )}
      
      {mode === 'flow-management' && (
        <DndProvider backend={HTML5Backend}>
            <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', display: 'flex', gap: 2, minHeight: 0 }}>
                <Box sx={{ flex: '0 1 320px', minWidth: 280 }}><CategoryManagementPane /></Box>
                <Box sx={{ flex: '1 1 70%', minWidth: 400 }}><FlowListPane /></Box>
            </Box>
        </DndProvider>
      )}

      {mode === 'flow-ai-chat' && (
        <>
            <AiChatView
                chatHistory={chatHistory}
                nodes={nodes}
                edges={edges}
                onSendMessage={handleSendMessage}
                isWaitingForUserInput={isWaitingForUserInput}
                isWaitingForAiResponse={isWaitingForAiResponse}
            />
            <Box sx={{ p: '0 24px 24px', textAlign: 'right' }}>
                <Button variant="contained" onClick={() => setIsSaveModalOpen(true)} disabled={nodes.length === 0}>
                    フローとして保存
                </Button>
            </Box>
        </>
      )}

      <FlowGeneratorModal open={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />

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
    </Box>
  );
}

export default DesignerPage;