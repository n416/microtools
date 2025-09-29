import React, { useState, useEffect } from 'react';
import { Box, Modal, List, ListItemButton, ListItemText, Typography, ThemeProvider } from '@mui/material';
import { theme } from './theme';
import Header from './components/Header';
import CustomerList from './components/CustomerList';
import CustomerDetail from './components/CustomerDetail';
import WorkflowList from './components/WorkflowList';
import TaskDetailPane from './components/TaskDetailPane';

// (データ定義とスタイル定義は変更ありません)
const initialWorkflowLibrary = [
  {
    id: 'wf001', name: '新規・コスト重視顧客向けフロー', description: '競合からの乗り換えで、初期費用を抑えたい顧客向けの標準フローです。',
    tasks: [
      { id: 1, text: 'X社製品との機能比較表を提示する', refId: 'K004', completed: false, details: '顧客が気にしているポイント（価格、サポート体制）を中心に、X社製品との優位性をまとめた比較表を提示します。', documents: [{ name: '機能比較表_template.xlsx', url: '#', checked: false },{ name: '競合X社_最新情報.pdf', url: '#', checked: false }] },
      { id: 2, text: '初期費用割引キャンペーンを適用する', refId: 'K005', completed: false, details: '現在適用可能なキャンペーンの中から、顧客にとって最もメリットの大きいものを選択して適用します。' },
      { id: 3, text: '導入後のサポート体制を説明する', refId: 'AI', completed: false, details: '24時間365日のサポート体制と、専任担当者がつくことをアピールします。' },
    ]
  },
  {
    id: 'wf002', name: '既存・品質重視顧客向けフロー', description: 'システム障害を経験し、品質を最重要視する既存顧客向けのフローです。',
    tasks: [
      { id: 1, text: '定例会で品質レポートを提出する', refId: 'K002', completed: true, details: '先月の稼働率、インシデント件数、解決までの平均時間をまとめたレポートを提出します。' },
      { id: 2, text: '次期製品の先行プレビューを案内する', refId: 'K003', completed: false, details: '開発中の次期製品について、NDA締結の上で先行プレビューの機会を提供し、特別感を演出します。' },
      { id: 3, text: '障害の再発防止策を改めて説明する', refId: 'K001', completed: false, details: '先日発生した障害の根本原因と、恒久的な再発防止策について、担当役員レベルで再度説明の場を設けます。', documents: [{ name: '再発防止策ご説明資料.pdf', url: '#', checked: true }] },
    ]
  },
];
const initialCustomerData = [
  { id: 1, name: '山田 太郎', company: '株式会社A', status: 'critical', assignedFlowId: 'wf002' },
  { id: 2, name: '田中 次郎', company: '株式会社B', status: 'progress', assignedFlowId: null },
  { id: 3, name: '鈴木 三郎', company: '株式会社C', status: 'success', assignedFlowId: null },
  { id: 4, name: '佐藤 四郎', company: '株式会社D', status: 'new', assignedFlowId: 'wf001' },
];
const modalStyle = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 600, bgcolor: 'background.paper', border: '2px solid #000', boxShadow: 24, p: 4,
};

function App() {
  const [customerData, setCustomerData] = useState(() => JSON.parse(localStorage.getItem('customerData')) || initialCustomerData);
  const [workflowLibrary, setWorkflowLibrary] = useState(() => JSON.parse(localStorage.getItem('workflowLibrary')) || initialWorkflowLibrary);
  const [selectedCustomerId, setSelectedCustomerId] = useState(1);
  const [selectedTaskIdentifier, setSelectedTaskIdentifier] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => { localStorage.setItem('customerData', JSON.stringify(customerData)); }, [customerData]);
  useEffect(() => { localStorage.setItem('workflowLibrary', JSON.stringify(workflowLibrary)); }, [workflowLibrary]);

  const selectedCustomer = customerData.find(c => c.id === selectedCustomerId);
  const currentWorkflow = workflowLibrary.find(wf => wf.id === selectedCustomer?.assignedFlowId);

  const selectedTask = React.useMemo(() => {
    if (!selectedTaskIdentifier) return null;
    const workflow = workflowLibrary.find(wf => wf.id === selectedTaskIdentifier.workflowId);
    if (!workflow) return null;
    return workflow.tasks.find(t => t.id === selectedTaskIdentifier.taskId) || null;
  }, [selectedTaskIdentifier, workflowLibrary]);

  const handleSelectCustomer = (id) => {
    setSelectedCustomerId(id);
  };

  const handleSelectTask = (taskId) => {
    if (currentWorkflow) {
      setSelectedTaskIdentifier({ workflowId: currentWorkflow.id, taskId: taskId });
    }
  };
  
  const handleAssignFlow = (workflowId) => {
    const updatedCustomerData = customerData.map(c => c.id === selectedCustomerId ? { ...c, assignedFlowId: workflowId } : c);
    setCustomerData(updatedCustomerData);
    setIsModalOpen(false);
  };
  
  const handleToggleTask = (taskId) => {
    setWorkflowLibrary(prevLibrary => prevLibrary.map(wf => {
      if (wf.id === currentWorkflow?.id) {
        return { ...wf, tasks: wf.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t) };
      } return wf;
    }));
  };

  const handleToggleDocument = (taskId, docName) => {
    setWorkflowLibrary(prevLibrary => prevLibrary.map(wf => {
      if (wf.id === currentWorkflow?.id) {
        return { ...wf, tasks: wf.tasks.map(t => {
          if (t.id === taskId && t.documents) {
            return { ...t, documents: t.documents.map(d => d.name === docName ? { ...d, checked: !d.checked } : d) };
          } return t;
        }) };
      } return wf;
    }));
  };
  
  const handleResetData = () => {
    if (window.confirm('保存されている全てのデータをリセットします。よろしいですか？')) {
      localStorage.removeItem('customerData');
      localStorage.removeItem('workflowLibrary');
      window.location.reload();
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
        <Box sx={{ p: '0 24px' }}>
          <Header onResetData={handleResetData} />
        </Box>
        <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', display: 'flex', gap: 2, minHeight: 0 }}>
          
          <Box sx={{ flex: '0 1 320px', minWidth: 280 }}>
            <CustomerList customers={customerData} selectedCustomerId={selectedCustomerId} onSelectCustomer={handleSelectCustomer} />
          </Box>

          {/* ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
              
              問題の根本原因だった Grid を Box に置き換え、
              純粋な Flexbox レイアウトに統一しました。
              
          ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ */}
          <Box sx={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 ,minWidth: 400}}>
            <CustomerDetail customer={selectedCustomer} onOpenModal={() => setIsModalOpen(true)} />
            <WorkflowList workflow={currentWorkflow} onToggleTask={handleToggleTask} onSelectTask={handleSelectTask} />
          </Box>

          <Box sx={{ flex: '0 1 35%', minWidth: 320 }}>
            <TaskDetailPane
              key={selectedTask ? `${selectedTaskIdentifier.workflowId}-${selectedTaskIdentifier.taskId}` : 'no-task-selected'}
              task={selectedTask}
              onToggleDocument={handleToggleDocument}
            />
          </Box>
        </Box>

        <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <Box sx={modalStyle}>
            <Typography variant="h6" component="h2" gutterBottom>業務フローを選択</Typography>
            <List>{workflowLibrary.map(wf => (<ListItemButton key={wf.id} onClick={() => handleAssignFlow(wf.id)}><ListItemText primary={wf.name} secondary={wf.description} /></ListItemButton>))}</List>
          </Box>
        </Modal>
      </Box>
    </ThemeProvider>
  );
}
export default App;