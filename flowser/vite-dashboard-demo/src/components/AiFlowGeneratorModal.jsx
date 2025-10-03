import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
    Modal, Box, Typography, TextField, Button, CircularProgress, IconButton, List, ListItem
} from '@mui/material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GeminiApiClient } from '../api/geminiApiClient.js';
import { addWorkflow, setApiCommunicating } from '../store/workflowSlice';
import { v4 as uuidv4 } from 'uuid';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '800px',
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
};

function AiFlowGeneratorModal({ open, onClose }) {
    const dispatch = useDispatch();
    const { library: knowledgeLibrary } = useSelector(state => state.knowledge);
    const { isApiCommunicating } = useSelector(state => state.workflow);

    const [workflowName, setWorkflowName] = useState('');
    const [userPrompt, setUserPrompt] = useState('');
    const [generatedTasks, setGeneratedTasks] = useState([]);

    useEffect(() => {
        if (!open) {
            setWorkflowName('');
            setUserPrompt('');
            setGeneratedTasks([]);
        }
    }, [open]);

    const handleGenerateFlow = async () => {
        if (!workflowName.trim() || !userPrompt.trim()) {
            alert('ワークフロー名とプロンプトの両方を入力してください。');
            return;
        }

        dispatch(setApiCommunicating(true));
        setGeneratedTasks([]);

        // ▼▼▼ 【修正】プロンプトの指示をより厳格に修正 ▼▼▼
        const systemPrompt = `あなたは優秀な業務コンサルタントです。あなたは以下の「知識ライブラリ」に含まれる知識項目だけを使い、ユーザーの要望に沿った業務フローを提案するタスクを実行します。

# 知識ライブラリ
${JSON.stringify(knowledgeLibrary, null, 2)}

# ユーザーの要望
${userPrompt}

# 厳格なルール
- **必ず知識ライブラリに存在する知識項目のみを組み合わせて**フローを構築してください。ライブラリに存在しないタスクを創作してはいけません。
- 生成する各タスクには、元となった知識ライブラリの知識ID（例: 'k-001'）を\`refId\`プロパティとして必ず含めてください。
- ユーザーの要望に最も合致すると思われる知識項目を選択し、適切な順序で並べてください。
- 出力は指定されたJSON形式の配列のみとし、それ以外のテキストは一切含めないでください。

# 出力JSONフォーマット
[
  {
    "id": "ユニークなIDを新たに生成",
    "text": "知識ライブラリのtextを引用",
    "details": "知識ライブラリのdetailsを引用",
    "refId": "元になった知識のID (例: 'k-001')",
    "type": "知識ライブラリのtypeを引用",
    "options": "知識ライブラリのoptionsが存在すれば引用"
  }
]
`;
        // ▲▲▲ ここまで修正 ▲▲▲

        try {
            const gemini = new GeminiApiClient();
            if (!gemini.isAvailable) {
                alert('Gemini APIキーまたはモデルIDが設定されていません。設定ページをご確認ください。');
                throw new Error('API not available');
            }
            const resultText = await gemini.generateContent(systemPrompt);
            
            const cleanedJson = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedTasks = JSON.parse(cleanedJson);

            // 生成された各タスクにユニークなIDを再割り当て
            const tasksWithUniqueIds = parsedTasks.map(task => ({
                ...task,
                id: uuidv4(), 
                completed: false, // デフォルト値を追加
                memo: '', // デフォルト値を追加
            }));

            setGeneratedTasks(tasksWithUniqueIds);
        } catch (error) {
            console.error('AI-based flow generation failed:', error);
            alert(`フローの自動生成に失敗しました: ${error.message}`);
        } finally {
            dispatch(setApiCommunicating(false));
        }
    };

    const handleSaveWorkflow = () => {
        if (!workflowName.trim() || generatedTasks.length === 0) {
            alert('ワークフロー名を入力し、タスクを1つ以上生成してください。');
            return;
        }

        const newWorkflow = {
            id: `wf-${uuidv4()}`,
            name: workflowName,
            description: `AIが「${userPrompt}」という指示を基に生成しました。`,
            tasks: generatedTasks,
        };

        dispatch(addWorkflow(newWorkflow));
        alert(`新しいワークフロー「${workflowName}」を保存しました。`);
        onClose();
    };

    const handleUpdateTaskText = (index, newText) => {
        const updatedTasks = [...generatedTasks];
        updatedTasks[index].text = newText;
        setGeneratedTasks(updatedTasks);
    };

    const handleAddTask = () => {
        const newTask = { id: uuidv4(), text: '新しいタスク', details: '', completed: false, memo: '' };
        setGeneratedTasks([...generatedTasks, newTask]);
    };

    const handleDeleteTask = (index) => {
        const updatedTasks = generatedTasks.filter((_, i) => i !== index);
        setGeneratedTasks(updatedTasks);
    };

    const onDragEnd = (result) => {
        if (!result.destination) return;
        const items = Array.from(generatedTasks);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setGeneratedTasks(items);
    };

    return (
        <Modal open={open} onClose={onClose}>
            <Box sx={modalStyle}>
                <Typography variant="h6" component="h2" gutterBottom>
                    AIによる業務フロー自動生成
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                    <TextField
                        label="ワークフロー名"
                        variant="outlined"
                        fullWidth
                        value={workflowName}
                        onChange={(e) => setWorkflowName(e.target.value)}
                    />
                    <TextField
                        label="プロンプト (どのようなフローを生成したいですか？)"
                        variant="outlined"
                        fullWidth
                        multiline
                        rows={4}
                        value={userPrompt}
                        onChange={(e) => setUserPrompt(e.target.value)}
                        placeholder="例: 新車販売の基本的な流れ, クレーム対応の詳細な手順"
                    />
                </Box>

                <Box sx={{ mb: 2 }}>
                    <Button
                        variant="contained"
                        onClick={handleGenerateFlow}
                        disabled={isApiCommunicating}
                    >
                        {isApiCommunicating ? <CircularProgress size={24} /> : '生成開始'}
                    </Button>
                    <Button onClick={onClose} sx={{ ml: 1 }}>キャンセル</Button>
                </Box>

                <Typography variant="subtitle1" gutterBottom>生成結果表示エリア</Typography>
                <Box sx={{ flexGrow: 1, overflow: 'auto', border: '1px solid #ccc', p: 1, borderRadius: 1, minHeight: '200px' }}>
                    {isApiCommunicating && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    )}
                    {!isApiCommunicating && generatedTasks.length === 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <Typography color="text.secondary">ここに生成されたタスクリストが表示されます</Typography>
                        </Box>
                    )}
                    {!isApiCommunicating && generatedTasks.length > 0 && (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="tasks">
                                {(provided) => (
                                    <List {...provided.droppableProps} ref={provided.innerRef} dense>
                                        {generatedTasks.map((task, index) => (
                                            <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                                                {(provided) => (
                                                    <ListItem
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        secondaryAction={
                                                            <IconButton edge="end" onClick={() => handleDeleteTask(index)}>
                                                                <DeleteIcon />
                                                            </IconButton>
                                                        }
                                                    >
                                                        <Box {...provided.dragHandleProps} sx={{ display: 'flex', alignItems: 'center', cursor: 'grab', mr: 1.5 }}>
                                                            <DragIndicatorIcon />
                                                        </Box>
                                                        <TextField
                                                            variant="standard"
                                                            fullWidth
                                                            value={task.text}
                                                            onChange={(e) => handleUpdateTaskText(index, e.target.value)}
                                                        />
                                                    </ListItem>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </List>
                                )}
                            </Droppable>
                        </DragDropContext>
                    )}
                </Box>
                 <Button onClick={handleAddTask} sx={{ mt: 1 }}>項目を追加</Button>


                <Box sx={{ mt: 'auto', pt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSaveWorkflow}
                        disabled={isApiCommunicating || generatedTasks.length === 0}
                    >
                        ワークフローとして保存
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}

export default AiFlowGeneratorModal;