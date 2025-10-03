import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Button, TextField, Divider, List, ListItem, ListItemText, IconButton, Accordion, AccordionSummary, AccordionDetails, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import Header from '../components/Header';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import { useSelector, useDispatch } from 'react-redux';
import {
  addPhase, deletePhase, updatePhase, reorderPhases,
  addSubPhase, deleteSubPhase, updateSubPhase, reorderSubPhases
} from '../store/knowledgeSlice'; // <- 修正：インポート元を caseSlice から knowledgeSlice に変更
import { motion, AnimatePresence } from "framer-motion";
import { styled } from '@mui/material/styles';


const CustomAccordionSummary = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: theme.spacing(0, 2),
  cursor: 'pointer',
  minHeight: '48px',
  transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
}));


function SystemSettingsPage() {
  const dispatch = useDispatch();
  const knowledgeLibrary = useSelector(state => state.knowledge.library);
  const [expanded, setExpanded] = useState(null);

  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : (expanded === panel ? null : panel));
  };

  const [renameModal, setRenameModal] = useState({ open: false, item: null, type: '', parentId: null });
  const [newName, setNewName] = useState('');
  const [addModal, setAddModal] = useState({ open: false, type: '', parentId: null });
  const [newItemName, setNewItemName] = useState('');

  useEffect(() => {
    if (renameModal.item) setNewName(renameModal.item.name);
  }, [renameModal.item]);

  const openRenameModal = (item, type, parentId = null) => {
    setRenameModal({ open: true, item, type, parentId });
  };
  const closeRenameModal = () => {
    setRenameModal({ open: false, item: null, type: '', parentId: null });
  };
  const handleRename = () => {
    if (!newName.trim() || !renameModal.item) return;
    if (renameModal.type === 'phase') {
      dispatch(updatePhase({ id: renameModal.item.id, name: newName }));
    } else if (renameModal.type === 'subPhase') {
      dispatch(updateSubPhase({ phaseId: renameModal.parentId, subPhaseId: renameModal.item.id, name: newName }));
    }
    closeRenameModal();
  };

  const openAddModal = (type, parentId = null) => {
    setAddModal({ open: true, type, parentId });
  };
  const closeAddModal = () => {
    setAddModal({ open: false, type: '', parentId: null });
    setNewItemName('');
  };
  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    if (addModal.type === 'phase') {
      dispatch(addPhase({ name: newItemName }));
    } else if (addModal.type === 'subPhase') {
      dispatch(addSubPhase({ phaseId: addModal.parentId, name: newItemName }));
    }
    closeAddModal();
  };

  const handleDeletePhase = (phase) => {
    if (phase.subPhases.length > 0) {
      alert('サブフェーズが存在するため削除できません。');
      return;
    }
    if (window.confirm(`「${phase.name}」を削除しますか？`)) {
      dispatch(deletePhase(phase.id));
    }
  };
  const handleReorderPhase = (index, direction) => {
    const destinationIndex = direction === 'up' ? index - 1 : index + 1;
    dispatch(reorderPhases({ sourceIndex: index, destinationIndex }));
  };
  const handleDeleteSubPhase = (phaseId, subPhaseId) => {
    if (window.confirm('このサブフェーズを削除しますか？')) {
      dispatch(deleteSubPhase({ phaseId, subPhaseId }));
    }
  };
  const handleReorderSubPhase = (phaseId, subPhaseIndex, direction) => {
    const destinationIndex = direction === 'up' ? subPhaseIndex - 1 : subPhaseIndex + 1;
    dispatch(reorderSubPhases({ phaseId, sourceIndex: subPhaseIndex, destinationIndex }));
  };
  const handleResetData = () => {
    if (window.confirm('アプリケーションの全てのデータがリセットされます。この操作は元に戻せません。よろしいですか？')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ p: '0 24px' }}><Header isLocked={false} /></Box>
      <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', overflow: 'auto' }}>
        <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
          <Typography variant="h5" gutterBottom>システム設定</Typography>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ my: 3 }}>
            <Typography variant="h6" gutterBottom>フェーズ管理</Typography>
            <List sx={{ p: 0 }}>
              <AnimatePresence>
                {knowledgeLibrary.map((phase, index) => (
                  <motion.div key={phase.id} layout transition={{ type: 'spring', stiffness: 300, damping: 25 }} style={{ marginBottom: '8px' }}>
                    <Accordion
                      expanded={expanded === phase.id}
                      onChange={(e, isExpanded) => handleAccordionChange(phase.id)(e, isExpanded)}
                      sx={{ '&.MuiAccordion-root:before': { display: 'none' } }}
                    >
                      <CustomAccordionSummary
                        aria-controls={`phase-content-${phase.id}`}
                        id={`phase-header-${phase.id}`}
                        onClick={() => handleAccordionChange(phase.id)(null, expanded !== phase.id)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
                          <Typography>{phase.name}</Typography>
                          <IconButton
                            onClick={(e) => { e.stopPropagation(); openRenameModal(phase, 'phase'); }}
                            size="small" sx={{ p: 0.5 }} aria-label={`${phase.name}の名前を変更`}
                          >
                            <EditIcon sx={{ fontSize: '1.1rem' }} />
                          </IconButton>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <IconButton onClick={(e) => { e.stopPropagation(); handleReorderPhase(index, 'up'); }} disabled={index === 0} size="small"><ArrowUpwardIcon fontSize="small" /></IconButton>
                          <IconButton onClick={(e) => { e.stopPropagation(); handleReorderPhase(index, 'down'); }} disabled={index === knowledgeLibrary.length - 1} size="small"><ArrowDownwardIcon fontSize="small" /></IconButton>
                          <IconButton onClick={(e) => { e.stopPropagation(); handleDeletePhase(phase); }} size="small"><DeleteIcon sx={{ fontSize: '1.1rem' }} /></IconButton>
                        </Box>
                        <ExpandMoreIcon sx={{ transform: expanded === phase.id ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', ml: 1 }} />
                      </CustomAccordionSummary>
                      <AccordionDetails sx={{ bgcolor: 'action.hover', borderTop: '1px solid', borderColor: 'divider' }}>
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
                          <List dense sx={{ p: 0 }}>
                            <AnimatePresence>
                              {phase.subPhases.map((sp, spIndex) => (
                                <motion.div key={sp.id} layout transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
                                  <ListItem
                                    disablePadding
                                    sx={{ display: 'flex', alignItems: 'center', width: '100%', py: 0.5, px: 1 }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <ListItemText primary={sp.name} sx={{ m: 0 }} />
                                      <IconButton
                                        onClick={() => openRenameModal(sp, 'subPhase', phase.id)}
                                        size="small"
                                        sx={{ p: 0.5 }}
                                        aria-label={`${sp.name}の名前を変更`}
                                      >
                                        <EditIcon sx={{ fontSize: '1.1rem' }} />
                                      </IconButton>
                                    </Box>
                                    <Box sx={{ flexGrow: 1 }} />
                                    <Box>
                                      <IconButton size="small" onClick={() => handleReorderSubPhase(phase.id, spIndex, 'up')} disabled={spIndex === 0}><ArrowUpwardIcon fontSize="small" /></IconButton>
                                      <IconButton size="small" onClick={() => handleReorderSubPhase(phase.id, spIndex, 'down')} disabled={spIndex === phase.subPhases.length - 1}><ArrowDownwardIcon fontSize="small" /></IconButton>
                                      <IconButton size="small" onClick={() => handleDeleteSubPhase(phase.id, sp.id)}><DeleteIcon sx={{ fontSize: '1.1rem' }} /></IconButton>
                                    </Box>
                                  </ListItem>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </List>
                          <Box>
                            <Button startIcon={<AddIcon />} onClick={() => openAddModal('subPhase', phase.id)} size="small">サブフェーズを追加</Button>
                          </Box>
                        </Paper>
                      </AccordionDetails>
                    </Accordion>
                  </motion.div>
                ))}
              </AnimatePresence>
            </List>
            <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Button startIcon={<AddIcon />} onClick={() => openAddModal('phase')}>業務フェーズを追加</Button>
            </Box>
          </Box>
          <Divider sx={{ my: 4 }} />
          <Box sx={{ my: 3 }}>
            <Typography variant="h6" gutterBottom color="error">データ管理</Typography>
            <Button variant="outlined" color="error" startIcon={<RestartAltIcon />} onClick={handleResetData}>全データをリセット</Button>
          </Box>
        </Paper>
      </Box>

      <Dialog open={renameModal.open} onClose={closeRenameModal}><DialogTitle>名称の変更</DialogTitle><DialogContent><TextField autoFocus margin="dense" label="新しい名前" type="text" fullWidth variant="standard" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRename()} /></DialogContent><DialogActions><Button onClick={closeRenameModal}>キャンセル</Button><Button onClick={handleRename}>保存</Button></DialogActions></Dialog>
      <Dialog open={addModal.open} onClose={closeAddModal}><DialogTitle>{addModal.type === 'phase' ? '新しい業務フェーズの追加' : '新しいサブフェーズの追加'}</DialogTitle><DialogContent><TextField autoFocus margin="dense" label="名前" type="text" fullWidth variant="standard" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddItem()} /></DialogContent><DialogActions><Button onClick={closeAddModal}>キャンセル</Button><Button onClick={handleAddItem}>追加</Button></DialogActions></Dialog>
    </Box>
  );
}

export default SystemSettingsPage;