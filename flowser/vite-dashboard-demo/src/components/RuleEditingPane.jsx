import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box, Paper, Typography, List, ListItemButton, ListItemText, RadioGroup, Radio,
  FormControlLabel, Button, TextField, Select, MenuItem, IconButton, FormControl, InputLabel, Divider
} from '@mui/material';
import { updateFlowJoint } from '../store/caseSlice';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { nanoid } from '@reduxjs/toolkit';

const initialJointState = {
  type: 'direct',
  prompt: '',
  nextFlowId: '',
  branches: [{ id: nanoid(), label: '', nextFlowId: '' }]
};

function RuleEditingPane() {
  const dispatch = useDispatch();
  const { flowLibrary } = useSelector(state => state.case);
  const [selectedFlowId, setSelectedFlowId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [joint, setJoint] = useState(initialJointState);

  const selectedFlow = flowLibrary.find(f => f.id === selectedFlowId);

  useEffect(() => {
    if (selectedFlow) {
      if (selectedFlow.joint) {
        setJoint({
            ...initialJointState,
            ...selectedFlow.joint,
            branches: selectedFlow.joint.branches?.length > 0 ? selectedFlow.joint.branches : initialJointState.branches
        });
        setIsEditing(true);
      } else {
        setJoint(initialJointState);
        setIsEditing(false);
      }
    } else {
      setSelectedFlowId(null);
      setIsEditing(false);
      setJoint(initialJointState);
    }
  }, [selectedFlowId, selectedFlow]);

  const handleSave = () => {
    let finalJoint = { type: joint.type };
    if (joint.type === 'direct') {
      finalJoint.nextFlowId = joint.nextFlowId;
    } else {
      finalJoint.prompt = joint.prompt;
      finalJoint.branches = joint.branches;
    }
    dispatch(updateFlowJoint({ flowId: selectedFlowId, joint: finalJoint }));
  };

  const handleDelete = () => {
    dispatch(updateFlowJoint({ flowId: selectedFlowId, joint: null }));
  };

  const handleAddBranch = () => {
    setJoint(prev => ({
      ...prev,
      branches: [...prev.branches, { id: nanoid(), label: '', nextFlowId: '' }]
    }));
  };

  const handleRemoveBranch = (branchId) => {
    setJoint(prev => ({
      ...prev,
      branches: prev.branches.filter(b => b.id !== branchId)
    }));
  };

  const handleBranchChange = (branchId, field, value) => {
    setJoint(prev => ({
      ...prev,
      branches: prev.branches.map(b => b.id === branchId ? { ...b, [field]: value } : b)
    }));
  };


  const availableFlows = flowLibrary.filter(f => f.id !== selectedFlowId);

  const renderEditor = () => {
    if (!isEditing) {
      return (
        <Box sx={{ textAlign: 'center' }}>
          <Button variant="contained" onClick={() => setIsEditing(true)}>
            ジョイントを設定する
          </Button>
        </Box>
      );
    }

    return (
      <Box>
        <FormControl component="fieldset" sx={{ mb: 2 }}>
          <RadioGroup row value={joint.type} onChange={(e) => setJoint({ ...initialJointState, type: e.target.value })}>
            <FormControlLabel value="direct" control={<Radio />} label="直結型" />
            <FormControlLabel value="branching" control={<Radio />} label="分岐型" />
          </RadioGroup>
        </FormControl>

        {joint.type === 'direct' && (
          <FormControl fullWidth>
            <InputLabel id="next-flow-select-label">次に開始するフロー</InputLabel>
            <Select
              labelId="next-flow-select-label"
              value={joint.nextFlowId}
              label="次に開始するフロー"
              onChange={(e) => setJoint(prev => ({ ...prev, nextFlowId: e.target.value }))}
            >
              {availableFlows.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
            </Select>
          </FormControl>
        )}

        {joint.type === 'branching' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="担当者への問いかけ (Prompt)"
              fullWidth
              value={joint.prompt}
              onChange={(e) => setJoint(prev => ({ ...prev, prompt: e.target.value }))}
            />
            <Typography variant="subtitle2">分岐先のリスト</Typography>
            {joint.branches.map((branch, index) => (
              <Paper key={branch.id} variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  label={`分岐名 ${index + 1}`}
                  value={branch.label}
                  onChange={(e) => handleBranchChange(branch.id, 'label', e.target.value)}
                  sx={{ flexGrow: 1 }}
                />
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel id={`branch-flow-select-label-${branch.id}`}>接続先フロー</InputLabel>
                  <Select
                    labelId={`branch-flow-select-label-${branch.id}`}
                    value={branch.nextFlowId}
                    label="接続先フロー"
                    onChange={(e) => handleBranchChange(branch.id, 'nextFlowId', e.target.value)}
                  >
                    {availableFlows.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <IconButton onClick={() => handleRemoveBranch(branch.id)} disabled={joint.branches.length <= 1}>
                  <DeleteOutlineIcon />
                </IconButton>
              </Paper>
            ))}
            <Button startIcon={<AddCircleOutlineIcon />} onClick={handleAddBranch}>
              分岐先を追加
            </Button>
          </Box>
        )}

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
          <Button color="error" onClick={handleDelete}>このジョイントを削除</Button>
          <Button variant="contained" onClick={handleSave}>保存</Button>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, height: '100%', minHeight: 0 }}>
      <Paper sx={{ flex: '0 1 320px', minWidth: 280, p: 2, overflow: 'auto' }}>
        <Typography variant="h6" gutterBottom>フロー選択</Typography>
        <List>
          {flowLibrary.map(flow => (
            <ListItemButton
              key={flow.id}
              selected={selectedFlowId === flow.id}
              onClick={() => setSelectedFlowId(flow.id)}
            >
              <ListItemText primary={flow.name} secondary={flow.joint ? `[${flow.joint.type === 'direct' ? '直結' : '分岐'}]` : ''} />
            </ListItemButton>
          ))}
        </List>
      </Paper>

      <Paper sx={{ flex: '1 1 auto', p: 3, overflow: 'auto' }}>
        {selectedFlow ? (
          <>
            <Typography variant="h6" gutterBottom>「{selectedFlow.name}」のジョイント設定</Typography>
            <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
              このフローが完了した後の、次のアクションを定義します。
            </Typography>
            <Divider sx={{ my: 2 }}/>
            {renderEditor()}
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography color="text.secondary">左のリストからフローを選択してください。</Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default RuleEditingPane;