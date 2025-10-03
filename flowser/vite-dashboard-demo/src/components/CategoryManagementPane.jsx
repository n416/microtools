import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Paper, Typography, Box, List, ListItemButton, ListItemText, Button, TextField, Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from '@mui/material';
import { selectCategoryId, addCategory, updateCategory, deleteCategory } from '../store/workflowCategorySlice';
import { useDrop } from 'react-dnd';
import { updateWorkflowCategory } from '../store/workflowSlice';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function CategoryManagementPane() {
    const dispatch = useDispatch();
    const { categories, selectedCategoryId } = useSelector(state => state.workflowCategory);
    const [modal, setModal] = useState({ open: false, mode: 'add', category: null });
    const [name, setName] = useState('');

    const [{ isOver, canDrop }, drop] = useDrop(() => ({
        accept: 'template',
        drop: (item, monitor) => {
            const didDrop = monitor.didDrop();
            if (didDrop) return;
            // ここでは何もしない。カテゴリ項目側で処理
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    }), []);

    const handleOpenModal = (mode, category = null) => {
        setModal({ open: true, mode, category });
        setName(category ? category.name : '');
    };

    const handleCloseModal = () => {
        setModal({ open: false, mode: 'add', category: null });
        setName('');
    };

    const handleSave = () => {
        if (!name.trim()) return;
        if (modal.mode === 'add') {
            dispatch(addCategory({ name }));
        } else {
            dispatch(updateCategory({ id: modal.category.id, name }));
        }
        handleCloseModal();
    };

    const handleDelete = (id) => {
        if (id === 'cat-uncategorized') return;
        // 関連するテンプレートの扱いを確認
        if (window.confirm('このカテゴリを削除しますか？関連するテンプレートは「未分類」に移動します。')) {
             dispatch(deleteCategory(id));
        }
    }

    return (
        <Paper ref={drop} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">カテゴリ管理</Typography>
                <Button startIcon={<AddIcon />} onClick={() => handleOpenModal('add')} size="small">追加</Button>
            </Box>
            <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
                <List dense>
                    {categories.map(cat => (
                        <CategoryItem
                            key={cat.id}
                            category={cat}
                            isSelected={selectedCategoryId === cat.id}
                            onSelect={() => dispatch(selectCategoryId(cat.id))}
                            onEdit={() => handleOpenModal('edit', cat)}
                            onDelete={() => handleDelete(cat.id)}
                        />
                    ))}
                </List>
            </Box>

            <Dialog open={modal.open} onClose={handleCloseModal}>
                <DialogTitle>{modal.mode === 'add' ? 'カテゴリ追加' : 'カテゴリ名変更'}</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" label="カテゴリ名" type="text" fullWidth variant="standard" value={name} onChange={(e) => setName(e.target.value)} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseModal}>キャンセル</Button>
                    <Button onClick={handleSave}>保存</Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
}

// ドロップターゲットとなるカテゴリ項目
function CategoryItem({ category, isSelected, onSelect, onEdit, onDelete }) {
    const dispatch = useDispatch();
    const [{ isOver, canDrop }, drop] = useDrop(() => ({
        accept: 'template',
        drop: (item) => {
            dispatch(updateWorkflowCategory({ workflowId: item.id, newCategoryId: category.id }));
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    }), [category.id]);

    return (
        <ListItemButton
            ref={drop}
            selected={isSelected}
            onClick={onSelect}
            sx={{
                border: canDrop ? (isOver ? '2px dashed #1976d2' : '2px dashed #ccc') : 'none',
                backgroundColor: isOver && canDrop ? 'action.hover' : undefined,
                display: 'flex',
                justifyContent: 'space-between'
            }}
        >
            <ListItemText primary={category.name} />
            {category.id !== 'cat-uncategorized' && (
                <Box>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(); }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
            )}
        </ListItemButton>
    )
}

export default CategoryManagementPane;