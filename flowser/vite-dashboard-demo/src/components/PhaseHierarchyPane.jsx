import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Paper, Typography, Box } from '@mui/material'; // ListItem, ListItemTextなどを削除
import {
    selectPhase, selectSubPhase
} from '../store/knowledgeSlice';

// 項目（フェーズ・サブフェーズ）のスタイルを定義
const itemSx = {
    display: 'flex',
    alignItems: 'center',
    p: '6px 8px', // denseなリストの高さを再現
    cursor: 'pointer',
    borderRadius: 1, // 角を丸くする
    transition: 'background-color 0.2s',
};

function PhaseHierarchyPane() {
    const dispatch = useDispatch();
    const { library, selectedPhaseId, selectedSubPhaseId } = useSelector(state => state.knowledge);

    return (
        <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>① 階層管理エリア</Typography>
            <Box sx={{ overflow: 'auto', flexGrow: 1, mt: 1 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {library.map(phase => (
                        <React.Fragment key={phase.id}>
                            {/* フェーズ項目 */}
                            <Box
                                onClick={() => dispatch(selectPhase(phase.id))}
                                sx={{
                                    ...itemSx,
                                    // 選択状態のスタイル
                                    backgroundColor: (selectedPhaseId === phase.id && !selectedSubPhaseId) ? 'primary.main'
                                        : (selectedPhaseId === phase.id ? 'action.hover' : 'transparent'),
                                    color: (selectedPhaseId === phase.id && !selectedSubPhaseId) ? 'primary.contrastText' : 'text.primary',
                                    '&:hover': {
                                        backgroundColor: (selectedPhaseId === phase.id && !selectedSubPhaseId) ? 'primary.dark' : 'action.hover',
                                    }
                                }}
                            >
                                <Typography variant="body2" sx={{ fontWeight: selectedPhaseId === phase.id ? 'bold' : 'normal' }}>
                                    {phase.name}
                                </Typography>
                            </Box>

                            {/* サブフェーズ項目 */}
                            {phase.subPhases.map(subPhase => (
                                <Box
                                    key={subPhase.id}
                                    onClick={() => dispatch(selectSubPhase(subPhase.id))}
                                    sx={{
                                        ...itemSx,
                                        pl: 4, // インデント
                                        // 選択状態のスタイル
                                        backgroundColor: selectedSubPhaseId === subPhase.id ? 'primary.main' : 'transparent',
                                        color: selectedSubPhaseId === subPhase.id ? 'primary.contrastText' : 'text.primary',
                                        '&:hover': {
                                            backgroundColor: selectedSubPhaseId === subPhase.id ? 'primary.dark' : 'action.hover',
                                        }
                                    }}
                                >
                                    <Typography variant="body2">
                                        {subPhase.name}
                                    </Typography>
                                </Box>
                            ))}
                        </React.Fragment>
                    ))}
                </Box>
            </Box>
        </Paper>
    );
}

export default PhaseHierarchyPane;