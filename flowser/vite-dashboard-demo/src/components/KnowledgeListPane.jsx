import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Paper, Typography, Box, Button, List, ListItem, ListItemButton, ListItemText, Chip } from '@mui/material'; // ListItem をインポート
import { selectKnowledge, startAddingKnowledge } from '../store/knowledgeSlice';
import TaskIcon from '@mui/icons-material/Description';
import BranchIcon from '@mui/icons-material/CallSplit';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useDrag } from 'react-dnd';

function KnowledgeItem({ knowledge, phaseId, subPhaseId }) {
    const dispatch = useDispatch();
    const { selectedKnowledgeId } = useSelector(state => state.knowledge);

    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'knowledge',
        item: { 
            id: knowledge.id, 
            source: { phaseId, subPhaseId } 
        },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }));

    return (
        // ▼▼▼ 【修正】 ListItemで全体をラップし、drag refをこちらに設定 ▼▼▼
        <ListItem
            ref={drag}
            disablePadding
            sx={{
                cursor: 'move',
                opacity: isDragging ? 0.5 : 1,
                // ドロップターゲットに重なった時のボーダー表示との競合を避けるため、背景色を少しつける
                bgcolor: 'background.paper', 
                borderRadius: 1,
                mb: 0.5,
            }}
        >
            {/* ListItemButtonはクリックと選択状態の管理に専念させる */}
            <ListItemButton
                selected={selectedKnowledgeId === knowledge.id}
                onClick={() => dispatch(selectKnowledge(knowledge.id))}
                sx={{ borderRadius: 1 }}
            >
                {knowledge.type === 'task' ? <TaskIcon sx={{ mr: 1 }}/> : <BranchIcon sx={{ mr: 1 }}/>}
                <ListItemText primary={knowledge.text} />
                <Chip label={knowledge.type} size="small" />
            </ListItemButton>
        </ListItem>
    );
}

function KnowledgeListPane({ onOpenAiModal }) {
    const dispatch = useDispatch();
    const { library, selectedPhaseId, selectedSubPhaseId } = useSelector(state => state.knowledge);

    let activeItem = null;
    if (selectedSubPhaseId) {
        for (const phase of library) {
            const foundSubPhase = phase.subPhases.find(sp => sp.id === selectedSubPhaseId);
            if (foundSubPhase) {
                activeItem = foundSubPhase;
                break;
            }
        }
    } else if (selectedPhaseId) {
        activeItem = library.find(p => p.id === selectedPhaseId);
    }

    const handleAddNew = () => {
        dispatch(startAddingKnowledge());
    };

    if (!activeItem) {
        return (
            <Paper sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">左のリストからフェーズまたはサブフェーズを選択してください。</Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>② 知識リスト: {activeItem.name}</Typography>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AutoFixHighIcon />}
                    onClick={onOpenAiModal}
                >
                    AIでフローを生成
                </Button>
            </Box>
            <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
                <List dense>
                    {(activeItem.knowledges || []).map(k => (
                        <KnowledgeItem 
                            key={k.id} 
                            knowledge={k}
                            phaseId={selectedPhaseId}
                            subPhaseId={selectedSubPhaseId}
                        />
                    ))}
                </List>
            </Box>
            <Button variant="contained" onClick={handleAddNew} sx={{ mt: 2 }}>新しい知識を追加</Button>
        </Paper>
    );
}

export default KnowledgeListPane;