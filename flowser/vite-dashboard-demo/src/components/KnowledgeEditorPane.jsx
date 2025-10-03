import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Paper, Typography, Box, Button, TextField, RadioGroup, FormControlLabel, Radio, IconButton } from '@mui/material';
import { addKnowledge, updateKnowledge, deleteKnowledge, finishEditing } from '../store/knowledgeSlice';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { nanoid } from '@reduxjs/toolkit';

// ▼▼▼ 【修正】detailsプロパティを追加 ▼▼▼
const initialFormState = { id: null, text: '', details: '', type: 'task', options: [] };

function KnowledgeEditorPane() {
  const dispatch = useDispatch();
  const { library, selectedPhaseId, selectedSubPhaseId, selectedKnowledgeId, isAddingNewKnowledge } = useSelector(state => state.knowledge);
  const [formState, setFormState] = useState(initialFormState);
  const [newOptionLabel, setNewOptionLabel] = useState('');

  const debounceTimeout = useRef(null);

  const activeKnowledge = library
    .flatMap(p => [...(p.knowledges || []), ...p.subPhases.flatMap(sp => sp.knowledges)])
    .find(k => k.id === selectedKnowledgeId);

  useEffect(() => {
    // ▼▼▼ 【修正】isAddingNewKnowledgeの時も初期フォーム state を使うように修正 ▼▼▼
    if (isAddingNewKnowledge) {
      setFormState(initialFormState);
    } else if (activeKnowledge) {
      setFormState(activeKnowledge);
    }
  }, [activeKnowledge, selectedKnowledgeId, isAddingNewKnowledge]);


  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (!isAddingNewKnowledge && !selectedKnowledgeId) {
      return;
    }

    debounceTimeout.current = setTimeout(() => {
      if (!formState.text.trim()) return;

      const payload = {
        phaseId: selectedPhaseId,
        subPhaseId: selectedSubPhaseId,
        knowledge: formState,
      };

      if (formState.id) {
        dispatch(updateKnowledge(payload));
      } else {
        dispatch(addKnowledge(payload));
      }
    }, 1500);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [formState, selectedPhaseId, selectedSubPhaseId, isAddingNewKnowledge, selectedKnowledgeId, dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleAddOption = () => {
    if (newOptionLabel.trim() === '') return;
    const newOption = { id: `option-${nanoid()}`, label: newOptionLabel.trim() };
    setFormState(prev => ({ ...prev, options: [...prev.options, newOption] }));
    setNewOptionLabel('');
  };

  const handleOptionLabelChange = (optionId, newLabel) => {
    setFormState(prev => ({
      ...prev,
      options: prev.options.map(opt =>
        opt.id === optionId ? { ...opt, label: newLabel } : opt
      )
    }));
  };

  const handleDeleteOption = (optionId) => {
    setFormState(prev => ({ ...prev, options: prev.options.filter(opt => opt.id !== optionId) }));
  };

  const handleDelete = () => {
    if (window.confirm('この知識を削除しますか？')) {
      dispatch(deleteKnowledge({
        phaseId: selectedPhaseId,
        subPhaseId: selectedSubPhaseId,
        knowledgeId: formState.id
      }));
      dispatch(finishEditing());
    }
  };

  if (!selectedPhaseId) {
    return (
      <Paper sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary">フェーズまたはサブフェーズを選択後、知識を選択または追加してください。</Typography>
      </Paper>
    );
  }

  if (!isAddingNewKnowledge && !selectedKnowledgeId) {
    return (
      <Paper sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1 }}>
        <Typography color="text.secondary">中央のリストから知識を選択するか、</Typography>
        <Typography color="text.secondary">「新しい知識を追加」ボタンを押してください。</Typography>
      </Paper>
    );
  }

  const editorTitle = isAddingNewKnowledge || !formState.id ? "③ 新しい知識の追加" : "③ 知識編集エリア";

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>{editorTitle}</Typography>
      <Box sx={{ overflow: 'auto', flexGrow: 1, pt: 1 }}>
        <TextField label="知識テキスト" fullWidth multiline rows={4} name="text" value={formState.text} onChange={handleChange} sx={{ mb: 2 }} />

        {/* ▼▼▼ 【追加】説明のテキストフィールド ▼▼▼ */}
        <TextField label="説明" fullWidth multiline rows={3} name="details" value={formState.details || ''} onChange={handleChange} sx={{ mb: 2 }} />

        <RadioGroup row name="type" value={formState.type} onChange={handleChange}>
          <FormControlLabel value="task" control={<Radio />} label="Task" />
          <FormControlLabel value="branch" control={<Radio />} label="Branch" />
        </RadioGroup>
        {formState.type === 'branch' && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">選択肢編集</Typography>
            {formState.options.map(opt => (
              <Box key={opt.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TextField value={opt.label} fullWidth variant="outlined" size="small" onChange={(e) => handleOptionLabelChange(opt.id, e.target.value)} />
                <IconButton onClick={() => handleDeleteOption(opt.id)}><DeleteIcon /></IconButton>
              </Box>
            ))}
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              <TextField label="新しい選択肢ラベル" fullWidth value={newOptionLabel} onChange={(e) => setNewOptionLabel(e.target.value)} size="small" />
              <IconButton onClick={handleAddOption}><AddIcon /></IconButton>
            </Box>
          </Box>
        )}
      </Box>
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        {formState.id && <Button color="error" onClick={handleDelete}>削除</Button>}
      </Box>
    </Paper>
  );
}

export default KnowledgeEditorPane;