import React from 'react';
import { Box } from '@mui/material'; // Gridを削除
import Header from '../components/Header';
import PhaseHierarchyPane from '../components/PhaseHierarchyPane';
import KnowledgeListPane from '../components/KnowledgeListPane';
import KnowledgeEditorPane from '../components/KnowledgeEditorPane';

function FlowDesignerPage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ p: '0 24px' }}>
        <Header isLocked={false} />
      </Box>

      {/* ▼▼▼ GridをBoxによるFlexboxレイアウトに置き換え ▼▼▼ */}
      <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', display: 'flex', gap: 2, minHeight: 0 }}>

        {/* ① 階層管理エリア (左) */}
        <Box sx={{ flex: '0 1 320px', minWidth: 280 }}>
          <PhaseHierarchyPane />
        </Box>

        {/* ② 知識リストエリア (中央) */}
        <Box sx={{ flex: '1 1 40%', minWidth: 300 }}>
          <KnowledgeListPane />
        </Box>

        {/* ③ 知識編集エリア (右) */}
        <Box sx={{ flex: '1 1 60%', minWidth: 400 }}>
          <KnowledgeEditorPane />
        </Box>

      </Box>
    </Box>
  );
}

export default FlowDesignerPage;