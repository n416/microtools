import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, Box, IconButton, Typography, Fade
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import type { Project, ImageBlock } from '../types';

interface MangaViewerProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  getAssetUrl: (id: string | null) => string | undefined;
}

const MangaViewer: React.FC<MangaViewerProps> = ({ open, onClose, project, getAssetUrl }) => {
  // -1: Cover, 0...N: Pages
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Reset on open
  useEffect(() => {
    if (open) setCurrentIndex(-1);
  }, [open]);

  // 画像ブロックのみ抽出
  const imageBlocks = project.storyboard.filter(b => b.type === 'image') as ImageBlock[];

  const totalPages = imageBlocks.length;
  const isCover = currentIndex === -1;
  const currentPage = !isCover ? imageBlocks[currentIndex] : null;

  // Navigation Logic
  const handleNext = useCallback(() => {
    if (currentIndex < totalPages - 1) setCurrentIndex(prev => prev + 1);
  }, [currentIndex, totalPages]);

  const handlePrev = useCallback(() => {
    if (currentIndex > -1) setCurrentIndex(prev => prev - 1);
  }, [currentIndex]);

  // Keyboard Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'ArrowRight' || e.key === ' ') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleNext, handlePrev, onClose]);

  // Content Resolver
  const currentImageUrl = isCover 
    ? getAssetUrl(project.coverAssetId) 
    : getAssetUrl(currentPage?.assignedAssetId || null);

  const currentText = isCover 
    ? project.synopsis 
    : currentPage?.dialogue;

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      sx={{ '& .MuiDialog-paper': { bgcolor: '#000' } }} // 完全な黒背景
    >
      {/* Close Button */}
      <IconButton 
        onClick={onClose} 
        sx={{ position: 'absolute', top: 16, right: 16, color: 'white', zIndex: 10, bgcolor: 'rgba(255,255,255,0.1)' }}
      >
        <CloseIcon />
      </IconButton>

      {/* Main Content Area */}
      <Box 
        sx={{ 
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', 
          alignItems: 'center', justifyContent: 'center', p: 2 
        }}
        onClick={handleNext} // Click anywhere to next
      >
        <Fade in={true} key={currentIndex} timeout={400}>
          <Box sx={{ 
            display: 'flex', flexDirection: 'column', alignItems: 'center', 
            maxWidth: '100%', maxHeight: '100%', gap: 2 
          }}>
            
            {/* Image Area */}
            <Box sx={{ position: 'relative', maxHeight: '75vh', maxWidth: '100vw' }}>
              {currentImageUrl ? (
                <Box 
                  component="img" 
                  src={currentImageUrl} 
                  sx={{ maxHeight: '75vh', maxWidth: '100%', objectFit: 'contain', boxShadow: '0 0 20px rgba(255,255,255,0.1)' }}
                />
              ) : (
                <Box sx={{ 
                  width: '60vh', height: '60vh', bgcolor: '#1e293b', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', color: '#64748b', flexDirection: 'column'
                }}>
                  <MenuBookIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
                  <Typography>No Image</Typography>
                </Box>
              )}
              
              {/* Page Number Badge */}
              <Box sx={{ 
                position: 'absolute', bottom: 10, right: 10, 
                bgcolor: 'rgba(0,0,0,0.7)', color: 'white', px: 1.5, py: 0.5, borderRadius: 1,
                fontSize: '0.8rem', fontFamily: 'monospace'
              }}>
                {isCover ? 'COVER' : `P.${currentPage?.pageNumber}`}
              </Box>
            </Box>

            {/* Text Area (Subtitle Style) */}
            <Box sx={{ 
              width: '100%', maxWidth: 800, minHeight: 100,
              bgcolor: 'rgba(20, 20, 20, 0.8)', border: '1px solid #333', borderRadius: 2, 
              p: 3, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center'
            }}>
              {isCover && (
                <Typography variant="h4" color="primary.main" fontWeight="bold" gutterBottom>
                  {project.title}
                </Typography>
              )}
              <Typography variant="h6" color="white" sx={{ fontStyle: isCover ? 'italic' : 'normal', lineHeight: 1.6 }}>
                {currentText || "..."}
              </Typography>
            </Box>

          </Box>
        </Fade>
      </Box>

      {/* Navigation Overlay Buttons (Mouse Hover) */}
      <Box sx={{ position: 'fixed', top: '50%', left: 20, transform: 'translateY(-50%)' }}>
        <IconButton onClick={(e) => { e.stopPropagation(); handlePrev(); }} disabled={currentIndex <= -1} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'primary.main' } }}>
          <NavigateBeforeIcon fontSize="large" />
        </IconButton>
      </Box>
      <Box sx={{ position: 'fixed', top: '50%', right: 20, transform: 'translateY(-50%)' }}>
        <IconButton onClick={(e) => { e.stopPropagation(); handleNext(); }} disabled={currentIndex >= totalPages - 1} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'primary.main' } }}>
          <NavigateNextIcon fontSize="large" />
        </IconButton>
      </Box>

    </Dialog>
  );
};

export default MangaViewer;
