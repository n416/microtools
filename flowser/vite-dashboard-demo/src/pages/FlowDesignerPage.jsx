import React, { useState } from 'react';
import { Box, ToggleButtonGroup, ToggleButton } from '@mui/material';
import Header from '../components/Header';
import PhaseHierarchyPane from '../components/PhaseHierarchyPane';
import KnowledgeListPane from '../components/KnowledgeListPane';
import KnowledgeEditorPane from '../components/KnowledgeEditorPane';
import AiFlowGeneratorModal from '../components/AiFlowGeneratorModal';
// ▼▼▼ DndProvider と HTML5Backend をインポート ▼▼▼
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import CategoryManagementPane from '../components/CategoryManagementPane';
import TemplateListPane from '../components/TemplateListPane';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import FolderCopyIcon from '@mui/icons-material/FolderCopy';

function FlowDesignerPage() {
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [mode, setMode] = useState('design');

  const handleModeChange = (event, newMode) => {
    if (newMode !== null) {
      setMode(newMode);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ p: '0 24px' }}>
        <Header isLocked={false} />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', p: '0 24px 16px' }}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          aria-label="designer mode"
        >
          <ToggleButton value="design" aria-label="design mode">
            <DesignServicesIcon sx={{ mr: 1 }} />
            知識ライブラリ設計
          </ToggleButton>
          <ToggleButton value="template" aria-label="template mode">
            <FolderCopyIcon sx={{ mr: 1 }} />
            テンプレート管理
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {mode === 'design' ? (
        <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', display: 'flex', gap: 2, minHeight: 0 }}>
          <Box sx={{ flex: '0 1 320px', minWidth: 280 }}>
            <PhaseHierarchyPane />
          </Box>
          <Box sx={{ flex: '1 1 40%', minWidth: 300 }}>
            <KnowledgeListPane onOpenAiModal={() => setIsAiModalOpen(true)} />
          </Box>
          <Box sx={{ flex: '1 1 60%', minWidth: 400 }}>
            <KnowledgeEditorPane />
          </Box>
        </Box>
      ) : (
        // ▼▼▼ DndProviderでtemplateモードのコンポーネント群をラップ ▼▼▼
        <DndProvider backend={HTML5Backend}>
            <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', display: 'flex', gap: 2, minHeight: 0 }}>
                <Box sx={{ flex: '0 1 320px', minWidth: 280 }}>
                    <CategoryManagementPane />
                </Box>
                <Box sx={{ flex: '1 1 70%', minWidth: 400 }}>
                    <TemplateListPane />
                </Box>
            </Box>
        </DndProvider>
      )}

      <AiFlowGeneratorModal
        open={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />
    </Box>
  );
}

export default FlowDesignerPage;