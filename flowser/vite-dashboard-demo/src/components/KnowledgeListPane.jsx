import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Paper, Typography, Box, Button, List, ListItemButton, ListItemText, Chip } from '@mui/material';
import { selectKnowledge, startAddingKnowledge } from '../store/knowledgeSlice'; // startAddingKnowledge をインポート
import TaskIcon from '@mui/icons-material/Description';
import BranchIcon from '@mui/icons-material/CallSplit';

function KnowledgeListPane() {
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
        dispatch(startAddingKnowledge()); // 【修正】新規追加モードを開始するアクションを呼ぶ
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
            <Typography variant="h6" gutterBottom>② 知識リスト: {activeItem.name}</Typography>
            <Box sx={{ overflow: 'auto' }}>
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