import os

files_content = {}

# 1. src/features/assets/AssetPool.tsx
# pages参照をstoryboard参照に修正し、画像ブロックのみを対象にするよう変更
files_content['src/features/assets/AssetPool.tsx'] = """import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import type { AssetCategory, Asset, ImageBlock } from '../../types';

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
      // ★修正: pages -> storyboard
      p.storyboard?.forEach(block => { 
        if (block.type === 'image' && block.assignedAssetId) ids.add(block.assignedAssetId); 
      });
    });
    return ids;
  }, [projects]);

  const showToast = (msg: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToast({ open: true, msg, type });
  };
  const handleToastClose = () => setToast({ ...toast, open: false });

  const checkAssetUsage = (id: string) => {
    const usages: string[] = [];
    projects.forEach(p => {
      if (p.coverAssetId === id) usages.push(`「${p.title}」の表紙`);
      // ★修正: pages -> storyboard
      p.storyboard?.forEach(block => {
        if (block.type === 'image' && block.assignedAssetId === id) {
          usages.push(`「${p.title}」のP${block.pageNumber}`);
        }
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
    if (referencedCount > 0) msg = `【警告】選択した画像のうち ${referencedCount}枚 がプロジェクトで使用されています。\\n削除すると表示されなくなりますが、よろしいですか？`;
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
    const usages = checkAssetUsage(id);
    let msg = 'この画像を削除しますか？';
    if (usages.length > 0) msg = `【警告】この画像は以下の場所で使用されています：\\n\\n・${usages.join('\\n・')}\\n\\n削除すると表示されなくなりますが、本当によろしいですか？`;
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
"""

# 2. src/features/projects/ProjectList.tsx
# ListItemTextのsecondaryがdiv(Stack)を含んでいるため、secondaryTypographyPropsでcomponent='div'を指定
files_content['src/features/projects/ProjectList.tsx'] = """import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Typography, Card, CardContent, TextField, Button, Chip, IconButton, 
  List, ListItemButton, ListItemText, Divider, Stack, Menu, MenuItem, ListItemIcon
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import FolderIcon from '@mui/icons-material/Folder';

// Libs
import { saveAs } from 'file-saver';
import { v4 as uuidv4 } from 'uuid';

// Redux
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchProjects, createOrUpdateProject, setCurrentProject, deleteProject } from './projectSlice';
import type { Project, StoryBlock } from '../../types';

// Components
import StoryGenModal from '../../components/StoryGenModal';
import { exportProjectToZip, importProjectFromZip } from '../../utils/projectIO';

const ProjectList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { items, status } = useAppSelector(state => state.projects);
  const assets = useAppSelector(state => state.assets.items);

  const [genres, setGenres] = useState<string[]>(['サイバーパンク', '日常']);
  const [newGenre, setNewGenre] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchProjects());
    }
  }, [status, dispatch]);

  const handleAddGenre = () => {
    if (newGenre.trim()) {
      setGenres([...genres, newGenre.trim()]);
      setNewGenre('');
    }
  };
  const handleDeleteGenre = (index: number) => {
    setGenres(genres.filter((_, i) => i !== index));
  };

  const handleCreateStory = () => {
    const prompt = `あなたは「予想外の展開」を得意とする超一流の漫画原作者であり、同時に優秀なAI漫画画像プロンプターです。
ユーザーから提供される「${genres.join('と')}」をもとに、24ページの読み切り漫画の企画、ネーム構成、そして表紙イラストを作成します。

以下のプロセスを順番に実行し、必ず画像プロンプトの生成を行ってください。

### Process (Chain)
1. **アイデアの化学反応 (Gacha Logic):**
   * 提供されたテーマを極端に解釈し、ランダムな「隠し味のジャンル」を1つ追加して独自の設定を作る。
   * **この段階で、表紙イラストの具体的な構図を決定する。**
2. **24ページの構成設計:**
   * P1-4(起), P5-12(承), P13-19(転), P20-24(結)。

### 出力形式 (JSONのみ)
\`\`\`json
{
  "coverImagePrompt": "表紙イラスト生成用プロンプト (英語)",
  "title": "タイトル (日本語)",
  "gachaResult": { "themeA": "テーマA", "themeB": "テーマB", "secretIngredient": "隠し味" },
  "synopsis": "3行あらすじ (日本語)",
  "pages": [
    { "pageNumber": 1, "sceneDescription": "シーン詳細(日)", "dialogue": "セリフ(日)", "imagePrompt": "画像プロンプト(英)" },
    ...
  ],
  "editorNote": "原作者コメント(日)"
}
\`\`\``;
    setCurrentPrompt(prompt);
    setModalOpen(true);
  };

  const handleImportFromModal = async (jsonStr: string) => {
    try {
      let clean = jsonStr.trim().replace(/```json/g, '').replace(/```/g, '');
      const s = clean.indexOf('{');
      const e = clean.lastIndexOf('}');
      if (s > -1 && e > -1) clean = clean.substring(s, e + 1);
      
      const data = JSON.parse(clean);
      if (!data.pages) throw new Error("ページデータがありません");

      // pages -> storyboard (ImageBlock) への変換
      const storyboard: StoryBlock[] = data.pages.map((p: any) => ({
        ...p,
        id: uuidv4(),
        type: 'image',
        assignedAssetId: null
      }));

      const newProject: Project = {
        id: uuidv4(),
        title: data.title,
        coverImagePrompt: data.coverImagePrompt,
        coverAssetId: null,
        gachaResult: data.gachaResult,
        synopsis: data.synopsis,
        storyboard: storyboard, // 新構造
        editorNote: data.editorNote,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await dispatch(createOrUpdateProject(newProject));
      dispatch(setCurrentProject(newProject));
      setModalOpen(false);
    } catch (e: any) {
      alert('JSON読み込みエラー: ' + e.message);
    }
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, pid: string) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setSelectedProjectId(pid);
  };
  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedProjectId(null);
  };

  const handleDeleteProject = () => {
    if (selectedProjectId && window.confirm('プロジェクトを削除しますか？（元に戻せません）')) {
      dispatch(deleteProject(selectedProjectId));
    }
    handleMenuClose();
  };

  const handleExportZIP = async () => {
    if (selectedProjectId) {
      const project = items.find(p => p.id === selectedProjectId);
      if (project) {
        handleMenuClose();
        try {
          await exportProjectToZip(project, assets);
        } catch (e) {
          console.error(e);
          alert('エクスポートに失敗しました');
        }
      }
    }
  };

  const handleExportJSON = () => {
    if (selectedProjectId) {
      const project = items.find(p => p.id === selectedProjectId);
      if (project) {
        const jsonStr = JSON.stringify(project, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        saveAs(blob, `${project.title || 'project'}.json`);
      }
    }
    handleMenuClose();
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const newProject = await importProjectFromZip(file, dispatch);
      alert(`「${newProject.title}」をインポートしました`);
    } catch (err: any) {
      console.error(err);
      alert('インポート失敗: ' + err.message);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSelectProject = (project: Project) => {
    dispatch(setCurrentProject(project));
  };

  return (
    <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight="bold" color="text.secondary">新規プロジェクト</Typography>
        <Button 
          variant="text" 
          startIcon={<FolderZipIcon />} 
          onClick={handleFileClick}
          size="small"
        >
          プロジェクト読込 (ZIP)
        </Button>
        <input 
          type="file" 
          ref={fileInputRef} 
          hidden 
          accept=".zip"
          onChange={handleFileChange} 
          aria-label="ZIPファイルをインポート"
        />
      </Box>

      <Card variant="outlined" sx={{ mb: 4, bgcolor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main', fontWeight: 'bold' }}>
            AI原作者（ガチャ）の設定
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
            {genres.map((g, i) => (
              <Chip key={i} label={g} onDelete={() => handleDeleteGenre(i)} size="small" />
            ))}
          </Stack>
          
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField 
              size="small" 
              placeholder="ジャンルを追加 (例: ホラー, 学園)" 
              value={newGenre} 
              onChange={e => setNewGenre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddGenre()}
              fullWidth
            />
            <Button variant="outlined" onClick={handleAddGenre} startIcon={<AddIcon />}>
              追加
            </Button>
          </Box>

          <Button 
            variant="contained" 
            fullWidth 
            size="large" 
            startIcon={<PlayArrowIcon />} 
            onClick={handleCreateStory}
            sx={{ fontWeight: 'bold', py: 1.5 }}
          >
            物語を生成する
          </Button>
        </CardContent>
      </Card>

      <Divider sx={{ mb: 4 }} />

      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
        <FolderIcon /> プロジェクトリスト
      </Typography>
      
      {items.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.disabled', border: '1px dashed #444', borderRadius: 2 }}>
          <Typography>プロジェクトがありません</Typography>
        </Box>
      ) : (
        <List sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {items.map(p => (
            <Card 
              key={p.id} 
              variant="outlined" 
              sx={{ 
                position: 'relative',
                borderRadius: 2,
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: 'primary.main' } 
              }}
            >
              <ListItemButton 
                onClick={() => handleSelectProject(p)} 
                sx={{ display: 'block', pr: 6 }} 
              >
                <ListItemText 
                  primary={
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
                      {p.title}
                    </Typography>
                  }
                  // ★修正: component='div' を追加してネスト違反を回避
                  secondaryTypographyProps={{ component: 'div' }}
                  secondary={
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '0.85rem' }}>
                        {p.synopsis}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={p.gachaResult.secretIngredient} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
                        <Typography variant="caption" color="text.disabled">
                          更新: {new Date(p.updatedAt).toLocaleDateString()}
                        </Typography>
                      </Stack>
                    </Stack>
                  }
                />
              </ListItemButton>

              <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                <IconButton onClick={(e) => handleMenuOpen(e, p.id)} size="small">
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
            </Card>
          ))}
        </List>
      )}

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleExportZIP}>
          <ListItemIcon><FolderZipIcon fontSize="small" /></ListItemIcon>
          <ListItemText>ZIPエクスポート</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleExportJSON}>
          <ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon>
          <ListItemText>JSONエクスポート</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteProject} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>削除</ListItemText>
        </MenuItem>
      </Menu>

      <StoryGenModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        prompt={currentPrompt}
        onImport={handleImportFromModal}
      />

    </Box>
  );
};

export default ProjectList;
"""

for filepath, content in files_content.items():
    dirpath = os.path.dirname(filepath)
    if dirpath and not os.path.exists(dirpath):
        os.makedirs(dirpath)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        print(f"Fixed: {filepath}")

print("\\nFix complete.")