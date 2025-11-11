import React, { useState, useEffect } from 'react';
import { 
  Box, Paper, Typography, Tabs, Tab, TextField, Button, Select, 
  MenuItem, InputLabel, FormControl, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, IconButton, Checkbox, FormControlLabel,
  Alert,
  // ★★★ 編集モーダル用のコンポーネントをインポート ★★★
  Dialog, DialogActions, DialogContent, DialogTitle,
  List, ListItem, ListItemButton, ListItemText // ★★★ List関連をインポート
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit'; // ★★★ 編集アイコンをインポート ★★★
import AddIcon from '@mui/icons-material/Add'; // ★★★ Addアイコンをインポート
import { useSelector, useDispatch } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import { db, IStaff, IStaffConstraints, IShiftPattern, IRequiredStaffing } from '../db/dexie';
// ★★★ 修正: updateStaff もインポート ★★★
import { addNewStaff, deleteStaff, updateStaff, setStaffList } from '../store/staffSlice'; 
// ★★★ 修正: updatePattern もインポート ★★★
import { addNewPattern, deletePattern, setPatterns, updatePattern } from '../store/patternSlice'; 
// ★★★ 修正: requirementSlice のアクションをインポート ★★★
import { addNewRequirement, deleteRequirement, setRequirements } from '../store/requirementSlice';

// TabPanel (ShiftCalendarPageからコピー)
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3, overflow: 'auto' }}>{children}</Box>}
    </div>
  );
}

// (制約の初期値 - staffSlice からコピー＆修正)
const getDefaultConstraints = (): IStaffConstraints => ({
  maxConsecutiveDays: 5,
  minIntervalHours: 12,
  maxTotalHoursPerWeek: 40,
  maxTotalHoursPerMonth: 160,
  maxWeekendShifts: 4,
  unavailableWeekdays: [],
  unavailableDatesOfMonth: [],
  unavailableNthWeekdays: [],
  unavailablePatterns: [],
  maxPatternCountPerMonth: [],
  maxConsecutivePattern: [],
  invalidPatternTransitions: [],
  avoidStaffIds: [],
  requireStaffIds: [],
  isMinor: false,
});

// 新規スタッフ登録フォーム
const NewStaffForm: React.FC = () => {
  const dispatch: AppDispatch = useDispatch();
  const [name, setName] = useState('');
  const [employmentType, setEmploymentType] = useState<'FullTime' | 'PartTime'>('FullTime');
  const [skills, setSkills] = useState(''); // (簡易的にカンマ区切り)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("氏名を入力してください。");
      return;
    }

    const newStaff: Omit<IStaff, 'staffId'> = {
      name: name.trim(),
      employmentType: employmentType,
      skills: skills.split(',').map(s => s.trim()).filter(Boolean), // カンマ区切りを配列に
      constraints: getDefaultConstraints(), // (一旦デフォルト制約)
      memo: ''
    };

    dispatch(addNewStaff(newStaff));

    // フォームをリセット
    setName('');
    setEmploymentType('FullTime');
    setSkills('');
  };

  return (
    <Paper component="form" onSubmit={handleSubmit} sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
      <TextField 
        label="氏名" 
        value={name} 
        onChange={(e) => setName(e.target.value)}
        required 
        size="small"
      />
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>雇用形態</InputLabel>
        <Select
          value={employmentType}
          label="雇用形態"
          onChange={(e) => setEmploymentType(e.target.value as any)}
        >
          <MenuItem value="FullTime">常勤</MenuItem>
          <MenuItem value="PartTime">パート</MenuItem>
        </Select>
      </FormControl>
      <TextField 
        label="スキル (カンマ区切り)" 
        value={skills} 
        onChange={(e) => setSkills(e.target.value)}
        size="small"
        helperText="例: Leader,新人"
      />
      <Button type="submit" variant="contained">追加</Button>
    </Paper>
  );
};

// スタッフ編集モーダル
interface EditStaffModalProps {
  staff: IStaff | null;
  onClose: () => void;
  onSave: (updatedStaff: IStaff) => void;
}

const EditStaffModal: React.FC<EditStaffModalProps> = ({ staff, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [employmentType, setEmploymentType] = useState<'FullTime' | 'PartTime'>('FullTime');
  const [skills, setSkills] = useState('');
  const [memo, setMemo] = useState('');

  // staff (編集対象) が変更されたら、フォームの内部状態を更新
  useEffect(() => {
    if (staff) {
      setName(staff.name);
      setEmploymentType(staff.employmentType);
      setSkills(staff.skills.join(', '));
      setMemo(staff.memo || '');
    }
  }, [staff]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff) return;

    const updatedStaff: IStaff = {
      ...staff, // staffId や constraints はそのまま維持
      name: name.trim(),
      employmentType: employmentType,
      skills: skills.split(',').map(s => s.trim()).filter(Boolean),
      memo: memo.trim(),
    };
    onSave(updatedStaff);
  };

  return (
    <Dialog open={!!staff} onClose={onClose}>
      <DialogTitle>スタッフ情報の編集</DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField 
            label="氏名" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            required 
            size="small"
            fullWidth
          />
          <FormControl size="small" fullWidth>
            <InputLabel>雇用形態</InputLabel>
            <Select
              value={employmentType}
              label="雇用形態"
              onChange={(e) => setEmploymentType(e.target.value as any)}
            >
              <MenuItem value="FullTime">常勤</MenuItem>
              <MenuItem value="PartTime">パート</MenuItem>
            </Select>
          </FormControl>
          <TextField 
            label="スキル (カンマ区切り)" 
            value={skills} 
            onChange={(e) => setSkills(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField 
            label="メモ (AI解釈の対象)" 
            value={memo} 
            onChange={(e) => setMemo(e.target.value)}
            size="small"
            multiline
            rows={3}
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSubmit} variant="contained">保存</Button>
      </DialogActions>
    </Dialog>
  );
};


// 新規勤務パターン登録フォーム
const NewPatternForm: React.FC = () => {
  const dispatch: AppDispatch = useDispatch();
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [durationHours, setDurationHours] = useState(8);
  const [crossesMidnight, setCrossesMidnight] = useState(false);
  const [isNightShift, setIsNightShift] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newPattern: Omit<IShiftPattern, 'patternId'> = {
      name: name.trim(),
      startTime,
      endTime,
      durationHours: Number(durationHours) || 0,
      crossesMidnight,
      isNightShift,
    };

    dispatch(addNewPattern(newPattern));

    // フォームをリセット
    setName('');
    setStartTime('09:00');
    setEndTime('18:00');
    setDurationHours(8);
    setCrossesMidnight(false);
    setIsNightShift(false);
  };

  return (
    <Paper component="form" onSubmit={handleSubmit} sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField label="パターン名" value={name} onChange={(e) => setName(e.target.value)} required size="small" />
      <TextField label="開始 (HH:MM)" value={startTime} onChange={(e) => setStartTime(e.target.value)} required size="small" sx={{ width: 120 }} />
      <TextField label="終了 (HH:MM)" value={endTime} onChange={(e) => setEndTime(e.target.value)} required size="small" sx={{ width: 120 }} />
      <TextField label="実働 (h)" value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} required size="small" type="number" sx={{ width: 100 }} />
      <FormControlLabel 
        control={<Checkbox checked={crossesMidnight} onChange={(e) => setCrossesMidnight(e.target.checked)} />} 
        label="日付またぎ" 
      />
      <FormControlLabel 
        control={<Checkbox checked={isNightShift} onChange={(e) => setIsNightShift(e.target.checked)} />} 
        label="夜勤 (負担集計用)" 
      />
      <Button type="submit" variant="contained">追加</Button>
    </Paper>
  );
};

// 勤務パターン編集モーダル
interface EditPatternModalProps {
  pattern: IShiftPattern | null;
  onClose: () => void;
  onSave: (updatedPattern: IShiftPattern) => void;
}

const EditPatternModal: React.FC<EditPatternModalProps> = ({ pattern, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [durationHours, setDurationHours] = useState(8);
  const [crossesMidnight, setCrossesMidnight] = useState(false);
  const [isNightShift, setIsNightShift] = useState(false);

  // pattern (編集対象) が変更されたら、フォームの内部状態を更新
  useEffect(() => {
    if (pattern) {
      setName(pattern.name);
      setStartTime(pattern.startTime);
      setEndTime(pattern.endTime);
      setDurationHours(pattern.durationHours);
      setCrossesMidnight(pattern.crossesMidnight);
      setIsNightShift(pattern.isNightShift);
    }
  }, [pattern]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern) return;

    const updatedPattern: IShiftPattern = {
      ...pattern, // patternId はそのまま維持
      name: name.trim(),
      startTime,
      endTime,
      durationHours: Number(durationHours) || 0,
      crossesMidnight,
      isNightShift,
    };
    onSave(updatedPattern);
  };

  return (
    <Dialog open={!!pattern} onClose={onClose}>
      <DialogTitle>勤務パターンの編集</DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="パターン名" value={name} onChange={(e) => setName(e.target.value)} required size="small" fullWidth />
          <TextField label="開始 (HH:MM)" value={startTime} onChange={(e) => setStartTime(e.target.value)} required size="small" fullWidth />
          <TextField label="終了 (HH:MM)" value={endTime} onChange={(e) => setEndTime(e.target.value)} required size="small" fullWidth />
          <TextField label="実働 (h)" value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} required size="small" type="number" fullWidth />
          <FormControlLabel 
            control={<Checkbox checked={crossesMidnight} onChange={(e) => setCrossesMidnight(e.target.checked)} />} 
            label="日付またぎ" 
          />
          <FormControlLabel 
            control={<Checkbox checked={isNightShift} onChange={(e) => setIsNightShift(e.target.checked)} />} 
            label="夜勤 (負担集計用)" 
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSubmit} variant="contained">保存</Button>
      </DialogActions>
    </Dialog>
  );
};


// 新規 必要人数定義 フォーム (簡略版)
interface NewRequirementFormProps {
  selectedPattern: IShiftPattern;
}
const NewRequirementForm: React.FC<NewRequirementFormProps> = ({ selectedPattern }) => {
  const dispatch: AppDispatch = useDispatch();
  
  const [date, setDate] = useState(''); // YYYY-MM-DD (空=null)
  const [minStaff, setMinStaff] = useState(1);
  const [requiredRole, setRequiredRole] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newReq: Omit<IRequiredStaffing, 'id'> = {
      date: date.trim() || null, // 空欄なら null
      patternId: selectedPattern.patternId, // 親から受け取ったIDを使う
      minStaff: Number(minStaff) || 0,
      requiredRole: requiredRole.split(',').map(s => s.trim()).filter(Boolean),
      requiredSkills: requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
    };

    dispatch(addNewRequirement(newReq));

    // フォームをリセット
    setDate('');
    setMinStaff(1);
    setRequiredRole('');
    setRequiredSkills('');
  };

  return (
    <Paper component="form" onSubmit={handleSubmit} sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      <Typography variant="body1" sx={{ mr: 1 }}>
        「{selectedPattern.name}」のルールを追加:
      </Typography>
      <TextField 
        label="日付 (YYYY-MM-DD)" 
        value={date} 
        onChange={(e) => setDate(e.target.value)}
        size="small"
        placeholder="全日指定の場合は空欄"
        sx={{ width: 180 }}
      />
      <TextField 
        label="最低人数" 
        value={minStaff} 
        onChange={(e) => setMinStaff(Number(e.target.value))} 
        required 
        size="small" 
        type="number" 
        sx={{ width: 100 }} 
      />
      <TextField 
        label="必須ロール (カンマ区切り)" 
        value={requiredRole} 
        onChange={(e) => setRequiredRole(e.target.value)}
        size="small"
        helperText="例: FullTime"
      />
      <TextField 
        label="必須スキル (カンマ区切り)" 
        value={requiredSkills} 
        onChange={(e) => setRequiredSkills(e.target.value)}
        size="small"
        helperText="例: Leader"
      />
      <Button type="submit" variant="contained">追加</Button>
    </Paper>
  );
};


// データ管理ページ本体
function DataManagementPage() {
  const [tabValue, setTabValue] = useState(0);
  const dispatch: AppDispatch = useDispatch();
  const staffList = useSelector((state: RootState) => state.staff.staff);
  const patternList = useSelector((state: RootState) => state.pattern.patterns);
  const requirementList = useSelector((state: RootState) => state.requirement.requirements);
  
  // 編集モーダルのための State
  const [editingStaff, setEditingStaff] = useState<IStaff | null>(null);
  const [editingPattern, setEditingPattern] = useState<IShiftPattern | null>(null);
  
  // 選択中のパターンID (UI連動用)
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);

  // このページでもDBからデータを読み込む
  useEffect(() => {
    const loadData = async () => {
      try {
        const allStaff = await db.staffList.toArray();
        const allPatterns = await db.shiftPatterns.toArray();
        const allRequirements = await db.requiredStaffing.toArray(); 
        
        dispatch(setStaffList(allStaff));
        dispatch(setPatterns(allPatterns));
        dispatch(setRequirements(allRequirements)); 

        // 読み込み後、最初のパターンを自動選択
        if (allPatterns.length > 0 && !selectedPatternId) { // ★★★ 既に選択済みの場合は上書きしない
          setSelectedPatternId(allPatterns[0].patternId);
        }

      } catch (e) {
        console.error("DBデータの読み込みに失敗:", e);
      }
    };
    loadData();
  }, [dispatch, selectedPatternId]); // ★★★ selectedPatternId が変更されたら再実行しないように修正


  // スタッフ削除ロジック
  const handleStaffDelete = (staffId: string) => {
    if (window.confirm("本当に削除しますか？ (※このスタッフの全アサインが解除されます)")) {
      dispatch(deleteStaff(staffId));
    }
  };
  
  // スタッフ更新ロジック
  const handleStaffUpdate = (updatedStaff: IStaff) => {
    dispatch(updateStaff(updatedStaff));
    setEditingStaff(null); // モーダルを閉じる
  };

  // パターン削除ロジック
  const handlePatternDelete = (patternId: string) => {
    if (window.confirm("本当に削除しますか？ (※このパターンの全アサインが解除されます)")) {
      dispatch(deletePattern(patternId));
      // ★★★ 削除したパターンが選択されていたら選択解除 ★★★
      if (selectedPatternId === patternId) {
        setSelectedPatternId(null);
      }
    }
  };
  
  // パターン更新ロジック
  const handlePatternUpdate = (updatedPattern: IShiftPattern) => {
    dispatch(updatePattern(updatedPattern));
    setEditingPattern(null); // モーダルを閉じる
  };

  // 必要人数定義 削除ロジック
  const handleRequirementDelete = (id: number) => {
    if (window.confirm("この定義を削除しますか？")) {
      dispatch(deleteRequirement(id!));
    }
  };

  // 選択中のパターンに紐づくデータ
  const selectedPattern = patternList.find(p => p.patternId === selectedPatternId);
  const filteredRequirements = requirementList.filter(r => r.patternId === selectedPatternId);


  return (
    <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px' }}>
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 120px)' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab label="スタッフ管理" />
            <Tab label="パターン・必要人数管理" />
            <Tab label="インポート/エクスポート (未)" />
          </Tabs>
        </Box>
        
        {/* スタッフ管理タブ */}
        <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" gutterBottom>新規スタッフの登録</Typography>
          <NewStaffForm />

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>スタッフ一覧</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>氏名</TableCell>
                  <TableCell>雇用形態</TableCell>
                  <TableCell>スキル</TableCell>
                  <TableCell>メモ</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {staffList.map((staff: IStaff) => (
                  <TableRow key={staff.staffId}>
                    <TableCell>{staff.name}</TableCell>
                    <TableCell>{staff.employmentType}</TableCell>
                    <TableCell>{(staff.skills || []).join(', ')}</TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {staff.memo}
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => setEditingStaff(staff)} color="primary">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleStaffDelete(staff.staffId)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
        
        {/* パターン・必要人数管理タブ */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {/* 左側: パターン一覧 */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>1. 勤務パターンを選択</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={() => setEditingPattern({} as IShiftPattern)}>
                新規パターン作成
              </Button>
              <List component={Paper} variant="outlined">
                {patternList.map((p: IShiftPattern) => (
                  <ListItemButton 
                    key={p.patternId} 
                    selected={selectedPatternId === p.patternId}
                    onClick={() => setSelectedPatternId(p.patternId)}
                  >
                    <ListItemText 
                      primary={p.name}
                      secondary={`${p.startTime} - ${p.endTime} (${p.durationHours}h) ${p.isNightShift ? '🌙' : ''}`}
                    />
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditingPattern(p); }} color="primary">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handlePatternDelete(p.patternId); }} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemButton>
                ))}
              </List>
            </Box>

            {/* 右側: 選択したパターンの必要人数定義 */}
            <Box sx={{ flex: 2 }}>
              {!selectedPattern ? (
                <Alert severity="info">左側から勤務パターンを選択してください。</Alert>
              ) : (
                <>
                  <Typography variant="h6" gutterBottom>2. 「{selectedPattern.name}」の必要人数定義</Typography>
                  <NewRequirementForm selectedPattern={selectedPattern} />
                  
                  <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>適用日</TableCell>
                          <TableCell>最低人数</TableCell>
                          <TableCell>必須ロール</TableCell>
                          <TableCell>必須スキル</TableCell>
                          <TableCell>操作</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredRequirements.map((r: IRequiredStaffing) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.date || '(全日)'}</TableCell>
                            <TableCell>{r.minStaff}</TableCell>
                            <TableCell>{(r.requiredRole || []).join(', ')}</TableCell>
                            <TableCell>{(r.requiredSkills || []).join(', ')}</TableCell>
                            <TableCell>
                              {/* (※編集ボタンは未実装) */}
                              <IconButton size="small" onClick={() => handleRequirementDelete(r.id!)} color="error">
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={2}><Typography>インポート/エクスポート（未実装）</Typography></TabPanel>
      </Paper>

      {/* 編集モーダルをレンダリング */}
      <EditStaffModal 
        staff={editingStaff}
        onClose={() => setEditingStaff(null)}
        onSave={handleStaffUpdate}
      />
      {/* 勤務パターン編集モーダルをレンダリング */}
      <EditPatternModal
        pattern={editingPattern}
        onClose={() => setEditingPattern(null)}
        onSave={handlePatternUpdate}
      />
    </Box>
  );
}

export default DataManagementPage;