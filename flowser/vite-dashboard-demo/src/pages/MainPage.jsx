import React, { useState, useEffect, useCallback } from 'react';
import { Box, Modal, List, ListItemButton, ListItemText, Typography, Button, Grid, Paper, Stack } from '@mui/material';
import Header from '../components/Header';
import CustomerList from '../components/CustomerList';
import CustomerDetail from '../components/CustomerDetail';
import WorkflowList from '../components/WorkflowList';
import TaskDetailPane from '../components/TaskDetailPane';
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined';
import ClearIcon from '@mui/icons-material/Clear';

const initialWorkflowLibrary = [
  {
    id: 'wf001', name: '【標準】新車販売フロー', description: '新車のキャンピングカーを販売する際の標準的な業務フローです。',
    tasks: [
      { id: 1, text: '顧客要望ヒアリングと車種選定', refId: 'AI', completed: false, details: '顧客の利用用途、予算、希望装備などを詳しくヒアリングし、最適な車種を提案します。パンフレットやデモカーを活用します。', documents: [{ name: '車種カタログ.pdf', url: '#', checked: false }] },
      { id: 2, text: '見積書作成とオプション確認', refId: 'K001', completed: false, details: '選択された車種をベースに、追加オプション（ソーラーパネル、FFヒーター、ナビ等）を含めた正式な見積書を作成し、提示します。' },
      { id: 3, text: '注文書作成と契約締結', refId: 'K002', completed: false, details: '見積内容に合意後、注文書を作成します。契約内容を丁寧に説明し、署名・捺印をいただきます。', documents: [{ name: '売買契約書テンプレート.docx', url: '#', checked: false }] },
      { id: 4, text: '納車前整備と最終点検', refId: 'K003', completed: false, details: 'メーカーから車両が到着後、専門スタッフがオプションの取り付け、内外装の最終チェック、清掃を行います。' },
      { id: 5, text: '納車および操作説明', refId: 'AI', completed: false, details: '顧客に来店いただき、車両の最終確認を行います。各種装備の詳しい操作方法を実演しながら説明し、キーをお渡しします。' },
    ]
  },
  {
    id: 'wf002', name: '【標準】中古車買取フロー', description: '顧客からキャンピングカーを買い取る際の標準的な業務フローです。',
    tasks: [
      { id: 1, text: '査定予約の受付と車両情報確認', refId: 'AI', completed: true, details: '電話またはウェブサイトから査定予約を受け付けます。車種、年式、走行距離、装備などの基本情報を事前にヒアリングします。' },
      { id: 2, text: '実車査定と査定額の提示', refId: 'K004', completed: false, details: '予約日に顧客に来店いただき、車両の状態（内外装、エンジン、電装系）を詳細にチェックします。市場価格と車両状態を基に、適正な査定額を算出・提示します。', documents: [{ name: '中古車査定チェックシート.xlsx', url: '#', checked: true }] },
      { id: 3, text: '必要書類の案内と準備依頼', refId: 'K005', completed: false, details: '契約に必要な書類（車検証、自賠責保険証、印鑑証明書など）のリストをお渡しし、準備を依頼します。' },
      { id: 4, text: '買取契約の締結と車両引き取り', refId: 'K002', completed: false, details: '書類が揃い次第、買取契約書に署名・捺印をいただきます。車両の引き取り日を調整し、車両をお預かりします。' },
      { id: 5, text: '名義変更手続きと入金処理', refId: 'K006', completed: false, details: '引き取った車両の名義変更手続きを速やかに行い、指定の口座へ買取金額を振り込みます。' },
    ]
  },
  {
    id: 'wf003', name: '【緊急】重大クレーム対応フロー', description: '雨漏りやエンジン不動など、顧客満足度に大きく影響する重大なクレームに対応するためのフローです。',
    tasks: [
      { id: 1, text: '第一次受付と状況ヒアリング', refId: 'AI', completed: false, details: '顧客からのクレーム連絡を最優先で受け付け、冷静に状況をヒアリングします。感情的にならず、事実確認に徹します。' },
      { id: 2, text: '車両の緊急引き取りまたは出張点検', refId: 'K007', completed: false, details: '車両が自走不能な場合は積載車を手配します。自走可能な場合でも、迅速に車両をお預かりするか、サービスカーで現地へ向かいます。' },
      { id: 3, text: '原因の徹底調査と特定', refId: 'K008', completed: false, details: 'サービス部門が総出で不具合の原因を調査・特定します。必要であればメーカーにも問い合わせ、情報を収集します。', documents: [{ name: '故障探求マニュアル.pdf', url: '#', checked: false }] },
      { id: 4, text: '顧客への経過報告と対応策の提案', refId: 'AI', completed: false, details: '調査状況を定期的に顧客へ報告し、不安を和らげます。原因が特定でき次第、修理内容、期間、費用（保証適用の有無）について正式に提案します。' },
      { id: 5, text: '修理・交換作業と最終テスト', refId: 'K003', completed: false, details: '提案内容に合意後、修理・交換作業を実施します。作業完了後、複数回の走行テストや漏水テストを行い、不具合が完全に解消されたことを確認します。' },
      { id: 6, text: '納車および謝罪と再発防止策の説明', refId: 'AI', completed: false, details: '車両を納車する際、改めて謝罪するとともに、今回の原因と実施した対策、今後の再発防止策について丁寧に説明します。' },
    ]
  },
];

const initialCustomerData = [
  { id: 1, name: '山田 太郎', company: '株式会社A', status: 'critical', assignedFlowIds: ['wf003'] },
  { id: 2, name: '田中 次郎', company: '株式会社B', status: 'progress', assignedFlowIds: ['wf001', 'wf002'] },
  { id: 3, name: '鈴木 三郎', company: '株式会社C', status: 'success', assignedFlowIds: [] },
  { id: 4, name: '佐藤 四郎', company: '株式会社D', status: 'new', assignedFlowIds: ['wf002'] },
];

const modalStyle = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 600, bgcolor: 'background.paper', border: '2px solid #000', boxShadow: 24, p: 4,
};

const keypadModalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
};

const PASSCODE = '1234';

function MainPage() {
  const [customerData, setCustomerData] = useState(() => {
    const savedData = JSON.parse(localStorage.getItem('customerData'));
    const dataToUse = savedData || initialCustomerData;

    return dataToUse.map(customer => {
      const newCustomer = { ...customer };
      if (!Array.isArray(newCustomer.assignedFlowIds)) {
        if (newCustomer.assignedFlowId) {
          newCustomer.assignedFlowIds = [newCustomer.assignedFlowId];
        } else {
          newCustomer.assignedFlowIds = [];
        }
      }
      delete newCustomer.assignedFlowId;
      return newCustomer;
    });
  });

  const [workflowLibrary, setWorkflowLibrary] = useState(() => JSON.parse(localStorage.getItem('workflowLibrary')) || initialWorkflowLibrary);
  const [selectedCustomerId, setSelectedCustomerId] = useState(1);
  const [selectedTaskIdentifier, setSelectedTaskIdentifier] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [isCustomerListLocked, setIsCustomerListLocked] = useState(() => JSON.parse(localStorage.getItem('isCustomerListLocked')) || false);
  const [isLockConfirmOpen, setIsLockConfirmOpen] = useState(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');

  useEffect(() => { localStorage.setItem('customerData', JSON.stringify(customerData)); }, [customerData]);
  useEffect(() => { localStorage.setItem('workflowLibrary', JSON.stringify(workflowLibrary)); }, [workflowLibrary]);
  useEffect(() => { localStorage.setItem('isCustomerListLocked', JSON.stringify(isCustomerListLocked)); }, [isCustomerListLocked]);

  const handleVisibilityChange = useCallback(() => {
    const securityModeEnabled = JSON.parse(localStorage.getItem('securityMode')) || false;
    
    if (securityModeEnabled && document.visibilityState === 'hidden' && !isCustomerListLocked) {
      setIsCustomerListLocked(true);
    }
  }, [isCustomerListLocked]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  const selectedCustomer = customerData.find(c => c.id === selectedCustomerId);
  
  const assignedFlows = React.useMemo(() => {
    if (!selectedCustomer) {
      return [];
    }
    return selectedCustomer.assignedFlowIds
      .map(id => workflowLibrary.find(wf => wf.id === id))
      .filter(Boolean);
  }, [selectedCustomer, workflowLibrary]);

  const currentWorkflow = workflowLibrary.find(wf => wf.id === selectedWorkflowId);

  useEffect(() => {
    const customer = customerData.find(c => c.id === selectedCustomerId);
    if (customer && customer.assignedFlowIds.length > 0) {
      const currentAssignedIds = customer.assignedFlowIds;
      if (!currentAssignedIds.includes(selectedWorkflowId)) {
        setSelectedWorkflowId(currentAssignedIds[0]);
      }
    } else {
      setSelectedWorkflowId(null);
    }
  }, [selectedCustomerId, customerData, selectedWorkflowId]);

  // ▼▼▼ 修正: タスクの自動選択ロジックの依存配列を修正 ▼▼▼
  useEffect(() => {
    const workflowToSelectTaskIn = workflowLibrary.find(wf => wf.id === selectedWorkflowId);

    if (workflowToSelectTaskIn && workflowToSelectTaskIn.tasks.length > 0) {
      const firstUncompletedTask = workflowToSelectTaskIn.tasks.find(t => !t.completed);
      if (firstUncompletedTask) {
        setSelectedTaskIdentifier({ workflowId: workflowToSelectTaskIn.id, taskId: firstUncompletedTask.id });
      } else {
        setSelectedTaskIdentifier({ workflowId: workflowToSelectTaskIn.id, taskId: workflowToSelectTaskIn.tasks[0].id });
      }
    } else {
      setSelectedTaskIdentifier(null);
    }
  }, [selectedCustomerId, selectedWorkflowId]); // 顧客かワークフローが変わった時だけ実行
  // ▲▲▲ 修正 ▲▲▲


  const selectedTask = React.useMemo(() => {
    if (!selectedTaskIdentifier) return null;
    const workflow = workflowLibrary.find(wf => wf.id === selectedTaskIdentifier.workflowId);
    if (!workflow) return null;
    return workflow.tasks.find(t => t.id === selectedTaskIdentifier.taskId) || null;
  }, [selectedTaskIdentifier, workflowLibrary]);

  const handleSelectCustomer = (id) => {
    setSelectedCustomerId(id);
  };
  
  const handleSelectWorkflow = (workflowId) => {
    setSelectedWorkflowId(workflowId);
  };

  const handleSelectTask = (taskId) => {
    if (selectedWorkflowId) {
      setSelectedTaskIdentifier({ workflowId: selectedWorkflowId, taskId: taskId });
    }
  };

  const handleAssignFlow = (workflowId) => {
    setCustomerData(prevData => prevData.map(c => {
      if (c.id === selectedCustomerId) {
        if (!c.assignedFlowIds.includes(workflowId)) {
          return { ...c, assignedFlowIds: [...c.assignedFlowIds, workflowId] };
        }
      }
      return c;
    }));
    setSelectedWorkflowId(workflowId);
    setIsModalOpen(false);
  };

  const handleUnassignFlow = (workflowId) => {
     setCustomerData(prevData => prevData.map(c => 
        c.id === selectedCustomerId 
        ? { ...c, assignedFlowIds: c.assignedFlowIds.filter(id => id !== workflowId) } 
        : c
    ));
  };

  const handleToggleTask = (taskId) => {
    setWorkflowLibrary(prevLibrary => prevLibrary.map(wf => {
      if (wf.id === selectedWorkflowId) {
        return { ...wf, tasks: wf.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t) };
      } return wf;
    }));
  };

  const handleToggleDocument = (taskId, docName) => {
    setWorkflowLibrary(prevLibrary => prevLibrary.map(wf => {
      if (wf.id === selectedWorkflowId) {
        return {
          ...wf, tasks: wf.tasks.map(t => {
            if (t.id === taskId && t.documents) {
              return { ...t, documents: t.documents.map(d => d.name === docName ? { ...d, checked: !d.checked } : d) };
            } return t;
          })
        };
      } return wf;
    }));
  };

  const handleToggleLock = () => {
    if (isCustomerListLocked) {
      setPasscodeInput('');
      setIsKeypadOpen(true);
    } else {
      setIsLockConfirmOpen(true);
    }
  };

  const handleConfirmLock = () => {
    setIsCustomerListLocked(true);
    setIsLockConfirmOpen(false);
  };

  const handleKeypadInput = (num) => {
    setPasscodeInput(prev => prev + num);
  };

  const handleKeypadBackspace = () => {
    setPasscodeInput(prev => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    setPasscodeInput('');
  };

  useEffect(() => {
    if (passcodeInput === PASSCODE) {
      setIsCustomerListLocked(false);
      setIsKeypadOpen(false);
      setPasscodeInput('');
    }
  }, [passcodeInput]);
  
  const keypadItems = [
    { type: 'num', value: 1 }, { type: 'num', value: 2 }, { type: 'num', value: 3 },
    { type: 'num', value: 4 }, { type: 'num', value: 5 }, { type: 'num', value: 6 },
    { type: 'num', value: 7 }, { type: 'num', value: 8 }, { type: 'num', value: 9 },
    { type: 'clear', value: <ClearIcon /> }, { type: 'num', value: 0 }, { type: 'bs', value: <BackspaceOutlinedIcon /> },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
        <Box sx={{ p: '0 24px' }}>
            <Header isLocked={isCustomerListLocked} onToggleLock={handleToggleLock} />
        </Box>
        <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', display: 'flex', gap: 2, minHeight: 0 }}>

            {!isCustomerListLocked && (
            <Box sx={{ flex: '0 1 320px', minWidth: 280, transition: 'all 0.3s ease' }}>
                <CustomerList customers={customerData} selectedCustomerId={selectedCustomerId} onSelectCustomer={handleSelectCustomer} />
            </Box>
            )}

            <Box sx={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', gap: 2, minHeight: 'fit-content', minWidth: 400 }}>
            <CustomerDetail 
                customer={selectedCustomer} 
                assignedFlows={assignedFlows}
                onUnassignFlow={handleUnassignFlow}
                onOpenModal={() => setIsModalOpen(true)} 
            />
            {/* ▼▼▼ 修正: currentWorkflowを渡すように戻す ▼▼▼ */}
            <WorkflowList 
                assignedFlows={assignedFlows}
                selectedWorkflowId={selectedWorkflowId}
                onSelectWorkflow={handleSelectWorkflow}
                currentWorkflow={currentWorkflow} 
                onSelectTask={handleSelectTask} 
                selectedTaskId={selectedTaskIdentifier?.taskId}
            />
            {/* ▲▲▲ 修正 ▲▲▲ */}
            </Box>

            <Box sx={{ flex: '0 1 35%', minWidth: 320 }}>
            <TaskDetailPane
                key={selectedTask ? `${selectedTaskIdentifier.workflowId}-${selectedTaskIdentifier.taskId}` : 'no-task-selected'}
                task={selectedTask}
                onToggleDocument={handleToggleDocument}
                onToggleTask={handleToggleTask}
            />
            </Box>
        </Box>

        <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
            <Box sx={modalStyle}>
            <Typography variant="h6" component="h2" gutterBottom>業務フローを選択</Typography>
            <List>
                {workflowLibrary.map(wf => {
                    const isAssigned = selectedCustomer?.assignedFlowIds.includes(wf.id);
                    return (
                        <ListItemButton key={wf.id} onClick={() => handleAssignFlow(wf.id)} disabled={isAssigned}>
                            <ListItemText primary={wf.name} secondary={wf.description} />
                        </ListItemButton>
                    );
                })}
            </List>
            </Box>
        </Modal>
        
        <Modal open={isLockConfirmOpen} onClose={() => setIsLockConfirmOpen(false)}>
            <Box sx={modalStyle} style={{ width: 400 }}>
            <Typography variant="h6" component="h2">顧客リストをロックしますか？</Typography>
            <Typography sx={{ mt: 2 }}>ロックすると、パスコードを入力するまでリストは表示されません。</Typography>
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button variant="outlined" onClick={() => setIsLockConfirmOpen(false)}>キャンセル</Button>
                <Button variant="contained" color="primary" onClick={handleConfirmLock}>リストをロック</Button>
            </Box>
            </Box>
        </Modal>

        <Modal open={isKeypadOpen} onClose={() => setIsKeypadOpen(false)}>
            <Box sx={keypadModalStyle}>
              <Paper sx={{ p: 2, borderRadius: 2, boxShadow: 24, border: '2px solid #000' }}>
                <Stack spacing={2}>
                    <Paper variant="outlined" sx={{ 
                        p: 1, 
                        textAlign: 'center',
                        letterSpacing: '0.5em', 
                        fontSize: '1.4rem', 
                        minHeight: '2.4rem',
                        overflow: 'hidden'
                    }}>
                        {passcodeInput.replace(/./g, '*')}
                    </Paper>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, width: 240 }}>
                        {keypadItems.map((item) => {
                            let clickHandler = () => {};
                            if (item.type === 'num') clickHandler = () => handleKeypadInput(item.value.toString());
                            if (item.type === 'clear') clickHandler = handleKeypadClear;
                            if (item.type === 'bs') clickHandler = handleKeypadBackspace;

                            return (
                                <Box key={`${item.type}-${item.value}`} sx={{ flexBasis: 'calc(33.333% - 8px)', flexGrow: 1 }}>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        onClick={clickHandler}
                                        sx={{ height: '55px', fontSize: '1.2rem' }}
                                    >
                                        {item.value}
                                    </Button>
                                </Box>
                            );
                        })}
                    </Box>
                </Stack>
              </Paper>
            </Box>
        </Modal>
    </Box>
  );
}
export default MainPage;