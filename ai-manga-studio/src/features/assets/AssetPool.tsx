import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Box, Typography, Tabs, Tab, IconButton, Menu, MenuItem, 
  ListItemIcon, ListItemText, Dialog, Button, Tooltip, Snackbar, Alert, Paper, Chip
} from '@mui/material';

// Icons
import CollectionsIcon from '@mui/icons-material/Collections';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete'; 
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import LinkIcon from '@mui/icons-material/Link';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import LibraryAddCheckIcon from '@mui/icons-material/LibraryAddCheck';

// dnd-kit
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, 
  DragOverlay, TouchSensor
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';

import {
  SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Redux & Types
import { useAppSelector, useAppDispatch } from '../../app/hooks';
import { fetchAssets, addAsset, deleteAsset, moveAssetCategory, reorderAssets, deleteMultipleAssets } from './assetSlice';
import type { AssetCategory, Asset } from '../../types';

// --- 1. AssetCard Component ---
interface AssetCardProps {
  asset: Asset;
  activeTab?: AssetCategory;
  isOverlay?: boolean;
  isReferenced?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  onMenuOpen?: (e: React.MouseEvent<HTMLElement>, id: string) => void;
  onDelete?: (id: string) => void;
  onOpenSlideshow?: () => void;
  dragHandleProps?: any;
  nativeDragProps?: any;
}

const AssetCard: React.FC<AssetCardProps> = ({ 
  asset, activeTab, isOverlay, isReferenced, 
  selectionMode, isSelected, onToggleSelection,
  onMenuOpen, onDelete, onOpenSlideshow, dragHandleProps, nativeDragProps 
}) => {
  const handleClick = (e: React.MouseEvent) => {
    if (selectionMode && onToggleSelection) {
      e.stopPropagation();
      onToggleSelection(asset.id);
    } else if (onOpenSlideshow) {
      onOpenSlideshow();
    }
  };

  return (
    <Paper 
      elevation={isOverlay ? 8 : 1}
      sx={{ 
        width: '100%', height: '100%',
        border: '2px solid', 
        borderColor: isOverlay 
          ? 'primary.main' 
          : (selectionMode && isSelected) ? 'primary.main'
          : isReferenced ? 'success.main' : 'divider',
        borderRadius: 2, 
        overflow: 'hidden',
        position: 'relative',
        bgcolor: 'background.paper',
        transform: isOverlay ? 'scale(1.05)' : (isSelected ? 'scale(0.95)' : 'none'),
        transition: 'all 0.1s',
        cursor: isOverlay ? 'grabbing' : (selectionMode ? 'pointer' : 'default'),
        '&:hover': { borderColor: selectionMode ? 'primary.light' : (activeTab === 'material' ? 'primary.main' : 'secondary.main') },
        '&:hover .overlay-actions': { opacity: 1 },
      }}
      onClick={handleClick}
      {...(!selectionMode ? nativeDragProps : {})} 
    >
      <Box
        component="img"
        src={asset.url}
        alt="asset"
        loading="lazy"
        sx={{ 
          width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none',
          opacity: (selectionMode && !isSelected) ? 0.6 : 1 
        }} 
      />
      {!isOverlay && isReferenced && (
        <Box sx={{ position: 'absolute', top: 4, left: 4, zIndex: 1 }}>
          <Chip icon={<LinkIcon style={{ color: 'white', width: 14, height: 14 }} />} label="Used" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold', bgcolor: 'success.main', color: 'white', boxShadow: 2, '& .MuiChip-label': { px: 0.5 } }} />
        </Box>
      )}
      {!isOverlay && selectionMode && (
        <Box sx={{ position: 'absolute', top: 4, right: 4, zIndex: 2 }}>
          {isSelected ? <CheckCircleIcon color="primary" sx={{ bgcolor: 'white', borderRadius: '50%' }} /> : <RadioButtonUncheckedIcon sx={{ color: 'rgba(255,255,255,0.7)', filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.5))' }} />}
        </Box>
      )}
      {!isOverlay && !selectionMode && (
        <Box className="overlay-actions" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.3)', opacity: 0, transition: '0.2s', display: 'flex', alignItems: 'start', justifyContent: 'flex-end', p: 0.5, gap: 0.5 }}>
          <Tooltip title="削除">
            <IconButton size="small" sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: '#ff4444', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.9)' } }} onClick={(e) => { e.stopPropagation(); onDelete && onDelete(asset.id); }} onMouseDown={e => e.stopPropagation()}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      {!selectionMode && (
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', p: 0.5 }}>
          <IconButton sx={{ color: 'rgba(255,255,255,0.9)', cursor: isOverlay ? 'grabbing' : 'grab', mr: 'auto' }} size="small" {...dragHandleProps} onClick={e => e.stopPropagation()}>
            <DragHandleIcon fontSize="small" />
          </IconButton>
          {!isOverlay && onMenuOpen && (
            <IconButton sx={{ color: 'white' }} onClick={(e) => onMenuOpen(e, asset.id)} size="small">
              <MoreVertIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      )}
    </Paper>
  );
};

// --- 2. Sortable Wrapper ---
interface SortableAssetItemProps extends Omit<AssetCardProps, 'dragHandleProps'> {
  id: string;
}

const SortableAssetItem: React.FC<SortableAssetItemProps> = (props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1, zIndex: isDragging ? 0 : 'auto' };
  return (
    <Box ref={setNodeRef} style={style} id={props.id} sx={{ position: 'relative', aspectRatio: '1/1' }}>
      <AssetCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </Box>
  );
};

// --- 3. Main Component ---
const AssetPool: React.FC = () => {
  const dispatch = useAppDispatch();
  const { items, status } = useAppSelector((state) => state.assets);
  const projects = useAppSelector((state) => state.projects.items);
  
  const [activeTab, setActiveTab] = useState<AssetCategory>('material');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{ open: boolean, msg: string, type: 'success' | 'info' | 'warning' }>({ open: false, msg: '', type: 'success' });
  
  // Selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // DnD
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragSize, setDragSize] = useState<{ width: number, height: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (status === 'idle') dispatch(fetchAssets());
  }, [status, dispatch]);

  const filteredAssets = useMemo(() => items.filter(a => a.category === activeTab), [items, activeTab]);

  const usedAssetIds = useMemo(() => {
    const ids = new Set<string>();
    projects.forEach(p => {
      if (p.coverAssetId) ids.add(p.coverAssetId);
      p.pages.forEach(page => { if (page.assignedAssetId) ids.add(page.assignedAssetId); });
    });
    return ids;
  }, [projects]);

  const showToast = (msg: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToast({ open: true, msg, type });
  };
  const handleToastClose = () => setToast({ ...toast, open: false });

  // ★修正: checkAssetUsage をここに定義
  const checkAssetUsage = (id: string) => {
    const usages: string[] = [];
    projects.forEach(p => {
      if (p.coverAssetId === id) usages.push(`「${p.title}」の表紙`);
      p.pages.forEach(page => {
        if (page.assignedAssetId === id) usages.push(`「${p.title}」のP${page.pageNumber}`);
      });
    });
    return usages;
  };

  // --- Handlers ---
  const toggleSelectionMode = () => { setSelectionMode(!selectionMode); setSelectedIds(new Set()); };
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedIds(newSet);
  };
  const handleSelectAll = () => {
    if (selectedIds.size === filteredAssets.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredAssets.map(a => a.id)));
  };
  const handleDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    let referencedCount = 0;
    ids.forEach(id => { if (usedAssetIds.has(id)) referencedCount++; });
    let msg = `${ids.length}枚の画像を削除しますか？`;
    if (referencedCount > 0) msg = `【警告】選択した画像のうち ${referencedCount}枚 がプロジェクトで使用されています。\n削除すると表示されなくなりますが、よろしいですか？`;
    if (window.confirm(msg)) {
      dispatch(deleteMultipleAssets(ids));
      setSelectionMode(false); setSelectedIds(new Set());
      showToast(`${ids.length}枚削除しました`, 'info');
    }
  };

  const handleFiles = useCallback((files: FileList) => {
    Array.from(files).forEach(file => { if (file.type.startsWith('image/')) dispatch(addAsset({ file, category: activeTab })); });
    if(files.length > 0) showToast(`${files.length}枚追加しました`);
  }, [dispatch, activeTab]);

  const handleDropZone = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const handleDragStartNative = (e: React.DragEvent, assetId: string) => {
    e.dataTransfer.setData('assetId', assetId); e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    const node = document.getElementById(event.active.id as string);
    if (node) { const rect = node.getBoundingClientRect(); setDragSize({ width: rect.width, height: rect.height }); }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = filteredAssets.findIndex((item) => item.id === active.id);
      const newIndex = filteredAssets.findIndex((item) => item.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) dispatch(reorderAssets({ fromIndex: oldIndex, toIndex: newIndex, category: activeTab }));
    }
    setActiveDragId(null); setDragSize(null);
  };

  const handleTabDrop = (e: React.DragEvent, targetCategory: AssetCategory) => {
    e.preventDefault();
    const assetId = e.dataTransfer.getData('assetId');
    if (assetId) {
      dispatch(moveAssetCategory({ id: assetId, newCategory: targetCategory }));
      setActiveTab(targetCategory); showToast('カテゴリーを移動しました', 'info');
    } else if (e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach(file => { if (file.type.startsWith('image/')) dispatch(addAsset({ file, category: targetCategory })); });
      setActiveTab(targetCategory); showToast('画像をアップロードしました');
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: string) => {
    event.stopPropagation(); setAnchorEl(event.currentTarget); setSelectedAssetId(id);
  };
  const handleMenuClose = () => { setAnchorEl(null); setSelectedAssetId(null); };

  const handleDelete = (id: string) => {
    const usages = checkAssetUsage(id); // ★ここでの呼び出しがエラーになっていたが、定義済みなので解決
    let msg = 'この画像を削除しますか？';
    if (usages.length > 0) msg = `【警告】この画像は以下の場所で使用されています：\n\n・${usages.join('\n・')}\n\n削除すると表示されなくなりますが、本当によろしいですか？`;
    if (window.confirm(msg)) {
      dispatch(deleteAsset(id));
      if (slideshowIndex !== null) setSlideshowIndex(null);
      showToast('削除しました', 'info');
    }
    handleMenuClose();
  };

  const handleCopyUrl = async (id: string) => {
    const asset = items.find(a => a.id === id);
    if(asset) {
      try {
        const res = await fetch(asset.url); const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        showToast('画像をコピーしました');
      } catch(e) { console.error(e); }
    }
    handleMenuClose();
  };

  const handleDuplicate = async (id: string) => {
    const asset = items.find(a => a.id === id);
    if(asset) {
      try {
        const res = await fetch(asset.url); const blob = await res.blob();
        const file = new File([blob], "duplicate.png", { type: blob.type });
        dispatch(addAsset({ file, category: activeTab })); showToast('複製しました');
      } catch(e) { console.error(e); }
    }
    handleMenuClose();
  };

  const handleOpenSlideshow = (index: number) => setSlideshowIndex(index);
  const handleCloseSlideshow = () => setSlideshowIndex(null);
  const handleNext = () => { if (slideshowIndex !== null && slideshowIndex < filteredAssets.length - 1) setSlideshowIndex(slideshowIndex + 1); };
  const handlePrev = () => { if (slideshowIndex !== null && slideshowIndex > 0) setSlideshowIndex(slideshowIndex - 1); };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (slideshowIndex === null) return;
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') handleCloseSlideshow();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slideshowIndex, filteredAssets.length]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: selectionMode ? 'primary.dark' : 'background.paper', boxShadow: 1, zIndex: 1, minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {!selectionMode ? (
          <>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CollectionsIcon fontSize="small" color="primary" /> 画像プール
              </Typography>
              <Typography variant="caption" color="text.secondary">Drag Handle to Sort</Typography>
            </Box>
            <Tooltip title="選択モード（一括削除）"><IconButton onClick={toggleSelectionMode}><LibraryAddCheckIcon /></IconButton></Tooltip>
          </>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button onClick={toggleSelectionMode} variant="outlined" color="inherit" size="small" sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}>完了</Button>
              <Typography variant="subtitle1" color="white" fontWeight="bold">{selectedIds.size}枚 選択中</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={handleSelectAll} sx={{ color: 'white' }}>{selectedIds.size === filteredAssets.length ? '全解除' : '全選択'}</Button>
              <Button onClick={handleDeleteSelected} variant="contained" color="error" startIcon={<DeleteIcon />} disabled={selectedIds.size === 0}>削除</Button>
            </Box>
          </>
        )}
      </Box>

      <Tabs value={activeTab} onChange={(_, v) => { setActiveTab(v); if(selectionMode) setSelectedIds(new Set()); }} variant="fullWidth" indicatorColor={activeTab === 'material' ? 'primary' : 'secondary'} textColor="inherit" sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}>
        <Tab label="素材" value="material" sx={{ minHeight: 40, fontSize: '0.75rem', fontWeight: 'bold', color: activeTab==='material' ? 'primary.main' : 'text.disabled' }} onDragOver={e => e.preventDefault()} onDrop={e => handleTabDrop(e, 'material')} />
        <Tab label="生成結果" value="generated" sx={{ minHeight: 40, fontSize: '0.75rem', fontWeight: 'bold', color: activeTab==='generated' ? 'secondary.main' : 'text.disabled' }} onDragOver={e => e.preventDefault()} onDrop={e => handleTabDrop(e, 'generated')} />
      </Tabs>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1, position: 'relative' }} onDragOver={e => e.preventDefault()} onDrop={handleDropZone}>
        {filteredAssets.length === 0 ? (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed', borderColor: 'divider', borderRadius: 2, m: 1, color: 'text.disabled' }}>
            <Typography variant="body2">No Images</Typography><Typography variant="caption">Drag & Drop files here</Typography>
          </Box>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredAssets.map(a => a.id)} strategy={rectSortingStrategy}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 1 }}>
                {filteredAssets.map((asset, index) => (
                  <SortableAssetItem 
                    key={asset.id} id={asset.id} asset={asset} activeTab={activeTab}
                    isReferenced={usedAssetIds.has(asset.id)}
                    selectionMode={selectionMode} isSelected={selectedIds.has(asset.id)} onToggleSelection={toggleSelection}
                    onMenuOpen={handleMenuOpen} onDelete={handleDelete} onOpenSlideshow={() => handleOpenSlideshow(index)}
                    nativeDragProps={{ draggable: true, onDragStart: (e: React.DragEvent) => handleDragStartNative(e, asset.id) }}
                  />
                ))}
              </Box>
            </SortableContext>
            <DragOverlay>
              {activeDragId && dragSize ? (
                <Box sx={{ width: dragSize.width, height: dragSize.height }}>
                  <AssetCard asset={filteredAssets.find(i => i.id === activeDragId)!} isOverlay isReferenced={usedAssetIds.has(activeDragId)} />
                </Box>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={() => selectedAssetId && handleCopyUrl(selectedAssetId)}><ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon><ListItemText>クリップボードにコピー</ListItemText></MenuItem>
        <MenuItem onClick={() => selectedAssetId && handleDuplicate(selectedAssetId)}><ListItemIcon><FileCopyIcon fontSize="small" /></ListItemIcon><ListItemText>複製</ListItemText></MenuItem>
        <MenuItem onClick={() => selectedAssetId && handleDelete(selectedAssetId)} sx={{ color: 'error.main' }}><ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon><ListItemText>削除</ListItemText></MenuItem>
      </Menu>

      {slideshowIndex !== null && filteredAssets[slideshowIndex] && (
        <Dialog open={true} onClose={handleCloseSlideshow} maxWidth={false} PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.9)', color: 'white', maxWidth: '90vw', maxHeight: '90vh', boxShadow: 'none', backgroundImage: 'none' } }}>
          <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 600, minHeight: 400 }}>
            <IconButton onClick={handleCloseSlideshow} sx={{ position: 'absolute', top: 10, right: 10, color: 'white', zIndex: 10 }}><CloseIcon /></IconButton>
            <Box component="img" src={filteredAssets[slideshowIndex].url} sx={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
            {slideshowIndex > 0 && <IconButton onClick={handlePrev} sx={{ position: 'absolute', left: 10, color: 'white', bgcolor: 'rgba(255,255,255,0.1)' }}><ArrowBackIosNewIcon /></IconButton>}
            {slideshowIndex < filteredAssets.length - 1 && <IconButton onClick={handleNext} sx={{ position: 'absolute', right: 10, color: 'white', bgcolor: 'rgba(255,255,255,0.1)' }}><ArrowForwardIosIcon /></IconButton>}
            <Box sx={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 2 }}>
              <Button variant="contained" color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(filteredAssets[slideshowIndex].id)}>削除</Button>
              <Button variant="outlined" color="inherit" startIcon={<ContentCopyIcon />} onClick={() => handleCopyUrl(filteredAssets[slideshowIndex].id)}>コピー</Button>
              <Button variant="outlined" color="inherit" startIcon={<FileCopyIcon />} onClick={() => handleDuplicate(filteredAssets[slideshowIndex].id)}>複製</Button>
            </Box>
          </Box>
        </Dialog>
      )}

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={handleToastClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert onClose={handleToastClose} severity={toast.type} sx={{ width: '100%' }}>{toast.msg}</Alert></Snackbar>
    </Box>
  );
};

export default AssetPool;