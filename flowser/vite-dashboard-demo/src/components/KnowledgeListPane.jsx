import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Paper, Typography, Box, Button, List, ListItemButton, ListItemText, Chip } from '@mui/material';
import { selectKnowledge, startAddingKnowledge } from '../store/knowledgeSlice';
import TaskIcon from '@mui/icons-material/Description';
import BranchIcon from '@mui/icons-material/CallSplit';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'; // AIアイコン

function KnowledgeListPane({ onOpenAiModal }) { // onOpenAiModal を props として受け取る
    const dispatch = useDispatch();
    const { library, selectedPhaseId, selectedSubPhaseId, selectedKnowledgeId } = useSelector(state => state.knowledge);

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
                {/* ▼▼▼ AIフロー生成ボタン ▼▼▼ */}
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
                        <ListItemButton
                            key={k.id}
                            selected={selectedKnowledgeId === k.id}
                            onClick={() => dispatch(selectKnowledge(k.id))}
                        >
                            {k.type === 'task' ? <TaskIcon sx={{ mr: 1 }}/> : <BranchIcon sx={{ mr: 1 }}/>}
                            <ListItemText primary={k.text} />
                            <Chip label={k.type} size="small" />
                        </ListItemButton>
                    ))}
                </List>
            </Box>
            <Button variant="contained" onClick={handleAddNew} sx={{ mt: 2 }}>新しい知識を追加</Button>
        </Paper>
    );
}

export default KnowledgeListPane;