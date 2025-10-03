import React, { useMemo } from 'react'; // useMemo をインポート
import { Paper, Typography } from '@mui/material';
import ReactFlow, { Background, Controls, MiniMap, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';

function FlowchartComponent({ nodes, edges }) {
  // ▼▼▼ 【修正】 useMemoを使用して、edgesが変更された時だけスタイル計算を実行 ▼▼▼
  const styledEdges = useMemo(() => edges.map(edge => ({
    ...edge,
    animated: edge.data?.active === true,
    style: edge.data?.active === false 
      ? { stroke: '#ccc', strokeDasharray: '5,5' }
      : { stroke: '#333' },
  })), [edges]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

function FlowchartPane({ nodes, edges }) {
  return (
    <Paper sx={{ height: '100%', p: 2, display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>生成フローチャート</Typography>
      <ReactFlowProvider>
        <FlowchartComponent nodes={nodes} edges={edges} />
      </ReactFlowProvider>
    </Paper>
  );
}

export default FlowchartPane;