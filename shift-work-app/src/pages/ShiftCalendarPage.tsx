import React, { useEffect, useState } from 'react';
// Table, TableBody, TableCell, TableContainer, TableHead, TableRow をインポート
import { 
  Box, Paper, Typography, Tabs, Tab, TextField, Button, 
  CircularProgress, Alert, List, ListItem, ListItemText, Avatar, Chip,
  Tooltip, IconButton, ListSubheader,
  Dialog, DialogTitle, DialogContent, DialogActions, ListItemButton,
  Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useSelector, useDispatch } from 'react-redux';
import { db } from '../db/dexie'; // .ts は不要
import type { IStaff, IShiftPattern, IStaffConstraints, IRequiredStaffing } from '../db/dexie';
import { setStaffList, parseAndSaveConstraints } from '../store/staffSlice';
import { setPatterns } from '../store/patternSlice';
import { setRequirements } from '../store/requirementSlice';
// clearAdvice, fetchAssignmentAdvice をインポート
import { setRequiredSlots, type IRequiredSlot, clearAdvice, fetchAssignmentAdvice } from '../store/assignmentSlice'; 
import type { AppDispatch, RootState } from '../store';

// TabPanel (タブの中身を非表示にするコンポーネント)
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div 
      hidden={value !== index} // 非表示の制御はここだけ
      {...other}
    >
      {/* value === index の条件を削除し、常にBoxを描画する */}
      <Box sx={{ p: 3, overflow: 'auto' }}>{children}</Box>
    </div>
  );
}

// 勤務パターン (MOCK_PATTERNS)
const MOCK_PATTERNS: IShiftPattern[] = [
  { patternId: 'P01', name: '日勤', startTime: '09:00', endTime: '18:00', crossesMidnight: false, isNightShift: false, durationHours: 8 },
  { patternId: 'P02', name: '夜勤', startTime: '17:00', endTime: '09:30', crossesMidnight: true, isNightShift: true, durationHours: 14.5 }, // (休憩除く実働)
];

// スタッフ (MOCK_STAFF)
// (制約の初期値)
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

const MOCK_STAFF: IStaff[] = [
  { 
    staffId: 's001', name: 'Aさん (常勤)', employmentType: 'FullTime', 
    skills: ['Leader'],
    constraints: {
      ...getDefaultConstraints(),
      maxConsecutiveDays: 5,
    }, 
    memo: '毎週水曜は休み希望'
  },
  { 
    staffId: 's002', name: 'Bさん (パート)', employmentType: 'PartTime', 
    skills: [],
    constraints: {
      ...getDefaultConstraints(),
      maxConsecutiveDays: 3,
      maxTotalHoursPerWeek: 20,
    }, 
    memo: '今月は夜勤は月2回まで。Aさんとはできれば一緒の勤務は避けたい。'
  },
  { 
    staffId: 's003', name: 'Cさん (常勤)', employmentType: 'FullTime', 
    skills: ['Leader'],
    constraints: {
      ...getDefaultConstraints(),
    }, 
    memo: '夜勤は不可。Bさんとは勤務が合いません。'
  }
];

// 必要人数定義 (MOCK_REQUIREMENTS)
const MOCK_REQUIREMENTS: IRequiredStaffing[] = [
  { date: null, patternId: 'P01', minStaff: 3, requiredRole: [], requiredSkills: [] }, 
  { date: '2025-11-10', patternId: 'P01', minStaff: 5, requiredRole: [], requiredSkills: ['Leader'] }, // Leader必須
  { date: null, patternId: 'P02', minStaff: 1, requiredRole: ['FullTime'], requiredSkills: [] } // 常勤必須
];

// ★★★ 日付・時刻ヘルパー関数群 (ここから) ★★★

// "HH:mm" 形式の時刻を "YYYY-MM-DD" の日付に適用する
const getDateTime = (dateStr: string, timeStr: string): Date => {
  // Safari/Firefox対応のため、'-' を '/' に置換
  const safeDateStr = dateStr.replace(/-/g, '/');
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(safeDateStr);
  date.setHours(hours, minutes, 0, 0); // 時刻をセット
  return date;
};

// パターンの開始時刻をDateオブジェクトとして取得
const getStartTime = (dateStr: string, pattern: IShiftPattern): Date => {
  return getDateTime(dateStr, pattern.startTime);
};

// パターンの終了時刻をDateオブジェクトとして取得 (日付またぎ考慮)
const getEndTime = (dateStr: string, pattern: IShiftPattern): Date => {
  const endDate = getDateTime(dateStr, pattern.endTime);
  if (pattern.crossesMidnight) {
    endDate.setDate(endDate.getDate() + 1); // 翌日にセット
  }
  return endDate;
};

// 2025-11 (ハードコード) の日付リストを生成するヘルパー
const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month, 0).getDate();
};
const YEAR = 2025;
const MONTH = 11; // 11月 (Dateオブジェクトでは 10 になる)
const MONTH_DAYS = Array.from({ length: getDaysInMonth(YEAR, MONTH) }, (_, i) => {
  const day = i + 1;
  const date = new Date(YEAR, MONTH - 1, day);
  const dateStr = `${YEAR}-${MONTH.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  return { dateStr, weekday, dayOfWeek: date.getDay() }; // 曜日番号(dayOfWeek)も返す
});
// ★★★ 日付・時刻ヘルパー関数群 (ここまで) ★★★


// 勤務枠ビュー (WorkSlotCalendarView)
interface WorkSlotCalendarViewProps {
  onSlotClick: (slot: IRequiredSlot) => void;
  onFixSlotsClick: () => void;
  onRoughFillClick: () => void;
}
const WorkSlotCalendarView: React.FC<WorkSlotCalendarViewProps> = ({
  onSlotClick,
  onFixSlotsClick,
  onRoughFillClick
}) => {
  const { staff: staffList } = useSelector((state: RootState) => state.staff);
  const shiftPatterns = useSelector((state: RootState) => state.pattern.patterns);
  const requiredSlots = useSelector((state: RootState) => state.assignment.requiredSlots);
  const staffMap = React.useMemo(() => new Map(staffList.map((s: IStaff) => [s.staffId, s])), [staffList]);
  
  // スロットを (日付 x パターン) のマップに変換
  const slotsMap = React.useMemo(() => {
    const map = new Map<string, IRequiredSlot[]>(); // (キー: "日付_パターンID")
    for (const slot of requiredSlots) {
      const key = `${slot.date}_${slot.patternId}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(slot);
    }
    return map;
  }, [requiredSlots]);
  
  // スロットを日付でグループ化 (同時勤務NGチェック用)
  const slotsGroupedByDate = React.useMemo(() => {
    return requiredSlots.reduce((acc: { [key: string]: IRequiredSlot[] }, slot: IRequiredSlot) => {
      const date = slot.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(slot);
      return acc;
    }, {});
  }, [requiredSlots]);


  return (
    <>
      <Typography variant="h6" gutterBottom>ステップ0/2：勤務枠の生成と自動アサイン</Typography>
      {/* ボタンエリア */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={onFixSlotsClick}>
          1. 「勤務枠をFIX」 ({YEAR}-{MONTH})
        </Button>
        <Typography>&gt;&gt;</Typography>
        <Button variant="contained" color="secondary" onClick={onRoughFillClick}>
          2. 「ざっくり埋める」 (残枠のみ)
        </Button>
        <Button variant="outlined" color="error" onClick={onFixSlotsClick} sx={{ ml: 'auto' }}>
          アサインをリセット
        </Button>
      </Box>

      {/* カレンダーUI */}
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 120 }}>日付</TableCell>
              {shiftPatterns.map((p: IShiftPattern) => (
                <TableCell key={p.patternId} sx={{ minWidth: 150, background: p.isNightShift ? 'grey.200' : 'default' }}>
                  {p.name}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {/* 日付ごとにループ */}
            {MONTH_DAYS.map(dayInfo => (
              <TableRow key={dayInfo.dateStr} hover>
                <TableCell component="th" scope="row">
                  {dayInfo.dateStr.split('-')[2]}日 ({dayInfo.weekday})
                </TableCell>
                
                {/* パターンごとにループ */}
                {shiftPatterns.map((p: IShiftPattern) => {
                  const key = `${dayInfo.dateStr}_${p.patternId}`;
                  const slotsForCell = slotsMap.get(key) || [];
                  
                  return (
                    <TableCell 
                      key={key} 
                      sx={{ 
                        verticalAlign: 'top', 
                        borderLeft: '1px solid', 
                        borderColor: 'divider',
                        p: 0, // Listのpaddingで制御
                      }}
                    >
                      {/* セル内のスロットをリスト表示 */}
                      <List dense disablePadding>
                        {slotsForCell.map(slot => {
                          const staff = slot.assignedStaffId ? staffMap.get(slot.assignedStaffId) : null;
                          
                          // ★★★ 修正: 警告ロジック ★★★
                          let violationMessage: string | null = null;
                          // ★★★ staff と staff.constraints の両方が存在する場合のみチェック ★★★
                          if (staff && staff.constraints) { 
                            const { constraints } = staff;
                            const currentWeekday = dayInfo.dayOfWeek;

                            // 1. 毎週NG曜日 違反
                            if (constraints.unavailableWeekdays.includes(currentWeekday)) {
                              violationMessage = `毎週NG曜日 違反 (例: 水曜休み)`;
                            }
                            // 2. 勤務不可パターン 違反
                            else if (constraints.unavailablePatterns.includes(slot.patternId)) {
                              violationMessage = `勤務不可パターン 違反 (例: 夜勤不可)`;
                            }
                            // 3. 同時勤務NG (avoidStaffIds) 違反
                            else if (constraints.avoidStaffIds.length > 0) {
                              const otherStaffOnThisDay = (slotsGroupedByDate[slot.date] || [])
                                .filter(s => s.slotId !== slot.slotId && s.assignedStaffId)
                                .map(s => s.assignedStaffId as string);
                              
                              const avoidedStaff = constraints.avoidStaffIds.find(avoidId => otherStaffOnThisDay.includes(avoidId));
                              if (avoidedStaff) {
                                const avoidedStaffName = staffMap.get(avoidedStaff)?.name || '??';
                                violationMessage = `同時勤務NG 違反 (${avoidedStaffName} と一緒)`;
                              }
                            }
                          }
                          const itemStyle = violationMessage ? { bgcolor: 'warning.light' } : {};
                          // ★★★ 修正ここまで ★★★

                          return (
                            <ListItemButton 
                              key={slot.slotId} 
                              sx={{ p: 0.5, ...itemStyle }} 
                              onClick={() => onSlotClick(slot)} // 親のハンドラを呼ぶ
                            >
                              <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: '0.75rem', bgcolor: staff ? 'primary.main' : 'grey.400' }}>
                                {staff ? staff.name.charAt(0) : '?'}
                              </Avatar>
                              <ListItemText 
                                primary={staff ? staff.name : "未アサイン"}
                                secondary={
                                  <Box component="span" sx={{ display: 'flex', gap: 0.5 }}>
                                    {(slot.requiredRole || []).map(role => (
                                      <Chip key={role} label={role} size="small" color="error" variant="outlined" sx={{height: 16}} />
                                    ))}
                                    {(slot.requiredSkills || []).map(skill => (
                                      <Chip key={skill} label={skill} size="small" color="info" variant="outlined" sx={{height: 16}} />
                                    ))}
                                  </Box>
                                }
                                primaryTypographyProps={{ variant: 'body2' }}
                                secondaryTypographyProps={{ component: 'div' }}
                              />
                              {violationMessage && (
                                <Tooltip title={violationMessage} placement="top">
                                  <WarningAmberIcon color="error" sx={{ fontSize: 16, ml: 0.5 }} />
                                </Tooltip>
                              )}
                            </ListItemButton>
                          );
                        })}
                      </List>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};
// 勤務枠ビュー コンポーネント定義ここまで


// スタッフビュー コンポーネント定義
// (StaffCalendarView が受け取る props の型)
interface StaffCalendarViewProps {
  onSlotClick: (slot: IRequiredSlot) => void;
}

const StaffCalendarView: React.FC<StaffCalendarViewProps> = ({ onSlotClick }) => {
  // (ロジックはShiftCalendarPageから移動＆修正)
  const { staff: staffList } = useSelector((state: RootState) => state.staff);
  const shiftPatterns = useSelector((state: RootState) => state.pattern.patterns);
  const requiredSlots = useSelector((state: RootState) => state.assignment.requiredSlots);
  const patternMap = React.useMemo(() => new Map(shiftPatterns.map((p: IShiftPattern) => [p.patternId, p])), [shiftPatterns]);
  
  // アサインメントを (スタッフID x 日付) のマップに変換
  const assignmentsMap = React.useMemo(() => {
    const map = new Map<string, IRequiredSlot[]>(); // (キー: "スタッフID_日付")
    for (const slot of requiredSlots) {
      if (slot.assignedStaffId) {
        const key = `${slot.assignedStaffId}_${slot.date}`;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(slot); // (1日に複数勤務もありうる)
      }
    }
    return map;
  }, [requiredSlots]);

  return (
    <>
      <Typography variant="h6" gutterBottom>スタッフビュー（カレンダー）</Typography>

      {/* カレンダーUI */}
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 150 }}>スタッフ</TableCell>
              {MONTH_DAYS.map(dayInfo => (
                <TableCell 
                  key={dayInfo.dateStr} 
                  sx={{ 
                    minWidth: 80, 
                    textAlign: 'center', 
                    background: (dayInfo.dayOfWeek === 0 || dayInfo.dayOfWeek === 6) ? 'grey.200' : 'default' 
                  }}
                >
                  {dayInfo.dateStr.split('-')[2]}<br/>({dayInfo.weekday})
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {/* スタッフごとにループ */}
            {staffList.map((staff: IStaff) => (
              <TableRow key={staff.staffId} hover>
                <TableCell component="th" scope="row">
                  {staff.name}
                  <Typography variant="caption" display="block" color={staff.employmentType === 'FullTime' ? 'primary' : 'textSecondary'}>
                    ({staff.employmentType})
                  </Typography>
                </TableCell>
                
                {/* 日付ごとにループ */}
                {MONTH_DAYS.map(dayInfo => {
                  const key = `${staff.staffId}_${dayInfo.dateStr}`;
                  const assignmentsForCell = assignmentsMap.get(key) || [];
                  
                  return (
                    <TableCell 
                      key={key} 
                      sx={{ 
                        verticalAlign: 'top', 
                        borderLeft: '1px solid', 
                        borderColor: 'divider',
                        p: 0.5,
                        background: (dayInfo.dayOfWeek === 0 || dayInfo.dayOfWeek === 6) ? 'grey.100' : 'default'
                      }}
                    >
                      {/* セル内のアサイン結果を表示 */}
                      {assignmentsForCell.length === 0 ? (
                        <Typography variant="caption" color="textSecondary" sx={{display: 'block', textAlign: 'center'}}>
                          -
                        </Typography>
                      ) : (
                        assignmentsForCell.map(slot => {
                          const pattern = patternMap.get(slot.patternId);
                          return (
                            <Chip 
                              key={slot.slotId} 
                              label={pattern?.name || '??'} 
                              size="small" 
                              sx={{ 
                                width: '100%', 
                                mb: 0.5,
                                background: pattern?.isNightShift ? 'grey.400' : 'default',
                                cursor: 'pointer' // クリック可能であることを示す
                              }}
                              onClick={() => onSlotClick(slot)} // ★★★ 親のハンドラを呼ぶ
                            />
                          );
                        })
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};
// スタッフビュー コンポーネント定義ここまで



function ShiftCalendarPage() {
  const [tabValue, setTabValue] = useState(0);
  const dispatch: AppDispatch = useDispatch(); 

  const { staff: staffList, loading, error } = useSelector((state: RootState) => state.staff);
  const shiftPatterns = useSelector((state: RootState) => state.pattern.patterns);
  const requirements = useSelector((state: RootState) => state.requirement.requirements);
  const requiredSlots = useSelector((state: RootState) => state.assignment.requiredSlots);
  // AI助言用のStateをインポート
  const { adviceLoading, adviceError, adviceResult } = useSelector((state: RootState) => state.assignment);


  // 1. 手動調整ダイアログ用の State
  const [selectedSlot, setSelectedSlot] = useState<IRequiredSlot | null>(null);

  // 1. IDと名前をマップするヘルパー (UI表示用)
  const staffMap = React.useMemo(() => 
    new Map(staffList.map((s: IStaff) => [s.staffId, s])),
    [staffList]
  );
  const patternMap = React.useMemo(() =>
    new Map(shiftPatterns.map((p: IShiftPattern) => [p.patternId, p])),
    [shiftPatterns]
  );

  // 2. スロットを日付ごとにグループ化 (※旧UIの名残だが、AI助言で利用)
  const slotsGroupedByDate = React.useMemo(() => {
    return requiredSlots.reduce((acc: { [key: string]: IRequiredSlot[] }, slot: IRequiredSlot) => {
      const date = slot.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(slot);
      return acc;
    }, {});
  }, [requiredSlots]);

  // 3. 負担の可視化 (サイドバー用)
  const staffBurdenData = React.useMemo(() => {
    const burdenMap = new Map(staffList.map((s: IStaff) => {
      return [s.staffId, {
        staffId: s.staffId,
        name: s.name,
        employmentType: s.employmentType,
        assignmentCount: 0,
        nightShiftCount: 0,
        totalHours: 0,
        weekendCount: 0,
        maxHours: s.constraints.maxTotalHoursPerWeek * 4,
      }];
    }));
    for (const slot of requiredSlots) {
      if (slot.assignedStaffId) {
        const staffData = burdenMap.get(slot.assignedStaffId);
        const pattern = patternMap.get(slot.patternId);
        if (staffData && pattern) {
          staffData.assignmentCount++;
          staffData.totalHours += pattern.durationHours;
          if (pattern.isNightShift) {
            staffData.nightShiftCount++;
          }
          const dayOfWeek = new Date(slot.date.replace(/-/g, '/')).getDay(); // 0=Sun, 6=Sat
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            staffData.weekendCount++;
          }
        }
      }
    }
    // AI助言で使うため、Mapをそのまま返すように変更
    return burdenMap;

  }, [requiredSlots, staffList, patternMap]);


  // DB初期化ロジック (データが存在すれば上書きしない)
  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. DBのスタッフ数をカウント
        const staffCount = await db.staffList.count();
        
        // 2. スタッフ数が0 (初回起動) の場合のみ、モックデータを書き込む
        if (staffCount === 0) {
          console.log("DBが空のため、モックデータを書き込みます...");
          await db.staffList.bulkPut(MOCK_STAFF);
          await db.shiftPatterns.bulkPut(MOCK_PATTERNS);
          await db.requiredStaffing.bulkPut(MOCK_REQUIREMENTS); 
        } else {
          console.log("DBにデータが存在するため、モックデータの書き込みをスキップします。");
        }
        
        // 3. DBから全データを読み込む (常に実行)
        const allStaff = await db.staffList.toArray();
        const allPatterns = await db.shiftPatterns.toArray();
        const allRequirements = await db.requiredStaffing.toArray(); 
        
        // 4. Reduxストアにセット (常に実行)
        dispatch(setStaffList(allStaff));
        dispatch(setPatterns(allPatterns));
        dispatch(setRequirements(allRequirements)); 

      } catch (e) {
        console.error("DBの初期化/スキーマ更新に失敗:", e);
        alert("データベースのスキーマ更新に失敗しました。\n開発者ツールで IndexedDB (ShiftWorkAppDB) を手動で削除し、リロードしてください。");
      }
    };
    loadData();
  }, [dispatch]);

  // タブ切り替えハンドラ
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // AI解釈ボタン
  const handleParse = (staff: IStaff) => { 
    dispatch(parseAndSaveConstraints({
      staffId: staff.staffId,
      memo: staff.memo || '', 
      shiftPatterns: shiftPatterns, 
      currentMonthInfo: { month: '2025-11', dayOfWeekOn10th: '月曜日' } 
    }));
  };

  // ステップ0「枠をFIX」ボタンのロジック (アサインリセットにも流用)
  const handleFixSlotsClick = () => {
    const generatedSlots: IRequiredSlot[] = [];
    const monthStr = `${YEAR}-${MONTH.toString().padStart(2, '0')}`;
    
    for (const dayInfo of MONTH_DAYS) {
      const dateStr = dayInfo.dateStr; 
      for (const pattern of shiftPatterns) {
        let rule = requirements.find((r: IRequiredStaffing) => r.date === dateStr && r.patternId === pattern.patternId);
        if (!rule) {
          rule = requirements.find((r: IRequiredStaffing) => r.date === null && r.patternId === pattern.patternId);
        }
        if (rule) {
          for (let i = 1; i <= rule.minStaff; i++) {
            generatedSlots.push({
              slotId: `${dateStr}_${pattern.patternId}_${i}`,
              date: dateStr,
              patternId: pattern.patternId,
              requiredRole: rule.requiredRole || [], 
              requiredSkills: rule.requiredSkills || [], 
              assignedStaffId: null, // (必ず null になる = リセット)
            });
          }
        }
      }
    }
    dispatch(setRequiredSlots(generatedSlots));
  };
  
  // ステップ2「ざっくり埋める」ロジック
  const handleRoughFillClick = () => {
    // 1. 枠がFIXされていない場合のみアラート
    if (requiredSlots.length === 0) {
      alert('「1. 勤務枠をFIX」ボタンを先に実行し、アサイン対象スロットを生成してください。');
      return;
    }

    const patternsMap = new Map(shiftPatterns.map((p: IShiftPattern) => [p.patternId, p]));
    const allStaff: IStaff[] = staffList; 
    
    // 2. 負担カウントとアサイン履歴の初期化
    const assignmentCounts: { [key: string]: number } = {};
    allStaff.forEach((s: IStaff) => {
      assignmentCounts[s.staffId] = 0;
    });
    
    const staffAssignments = new Map<string, IRequiredSlot[]>();
    allStaff.forEach((s: IStaff) => {
      staffAssignments.set(s.staffId, []);
    });

    // 3. (重要) 既に手動アサインされているスロットをスキャンし、負担カウントと履歴に事前反映
    const manuallyAssignedSlots = requiredSlots.filter(slot => slot.assignedStaffId !== null);
    
    // (時系列で処理するためソート)
    manuallyAssignedSlots.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const patternA = patternsMap.get(a.patternId);
      const patternB = patternsMap.get(b.patternId);
      if (patternA && patternB) return patternA.startTime.localeCompare(b.startTime);
      return 0;
    });

    for (const slot of manuallyAssignedSlots) {
      if (slot.assignedStaffId) {
        assignmentCounts[slot.assignedStaffId]++;
        staffAssignments.get(slot.assignedStaffId)?.push(slot);
      }
    }

    // 4. 未アサインのスロットのみを対象に処理
    const newSlots = [...requiredSlots]; // 元の配列をコピー

    // 未アサインのスロットを日付順にソートして処理
    const unassignedSlots = newSlots
      .filter(slot => slot.assignedStaffId === null)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const patternA = patternsMap.get(a.patternId);
        const patternB = patternsMap.get(b.patternId);
        if (patternA && patternB) return patternA.startTime.localeCompare(b.startTime);
        return 0;
      });

    // --- 自動アサイン処理 (未アサインのスロットのみ) ---
    for (const slot of unassignedSlots) {
      const currentPattern = patternsMap.get(slot.patternId);
      if (!currentPattern) continue;

      let baseEligibleStaff: IStaff[] = [];
      
      baseEligibleStaff = allStaff.filter(s => {
        if (slot.requiredRole.length > 0 && !slot.requiredRole.some(role => s.employmentType === role)) {
          return false;
        }
        if (slot.requiredSkills.length > 0 && !slot.requiredSkills.every(skill => s.skills.includes(skill))) {
          return false;
        }
        return true;
      });

      const finalEligibleStaff = baseEligibleStaff.filter(staff => {
        const { constraints } = staff;
        const myAssignments = staffAssignments.get(staff.staffId) || [];
        if (myAssignments.length > 0) {
          const lastAssignment = myAssignments[myAssignments.length - 1];
          const lastPattern = patternsMap.get(lastAssignment.patternId);
          if (lastPattern) {
            const lastEndTime = getEndTime(lastAssignment.date, lastPattern);
            const currentStartTime = getStartTime(slot.date, currentPattern);
            const hoursBetween = (currentStartTime.getTime() - lastEndTime.getTime()) / (1000 * 60 * 60);
            if (hoursBetween < constraints.minIntervalHours) {
              return false; 
            }
          }
        }
        let consecutiveDays = 0;
        // (連勤チェック: 手動アサインも含めてチェック)
        for (let i = 1; i <= constraints.maxConsecutiveDays; i++) {
          const checkDate = new Date(slot.date.replace(/-/g, '/')); 
          checkDate.setDate(checkDate.getDate() - i);
          const checkDateStr = checkDate.toISOString().split('T')[0];
          if (myAssignments.some(a => a.date === checkDateStr)) {
            consecutiveDays++;
          } else {
            break; 
          }
        }
        if (consecutiveDays >= constraints.maxConsecutiveDays) {
          return false; 
        }
        return true; 
      });

      finalEligibleStaff.sort((a, b) => assignmentCounts[a.staffId] - assignmentCounts[b.staffId]);
      const assignedStaff = finalEligibleStaff[0]; 
      
      if (assignedStaff) {
        assignmentCounts[assignedStaff.staffId]++; 
        
        // 5. コピーした配列 (newSlots) の該当スロットを更新
        const indexToUpdate = newSlots.findIndex(s => s.slotId === slot.slotId);
        if (indexToUpdate !== -1) {
          
          const updatedSlot = {
            ...newSlots[indexToUpdate], // 既存のスロット情報
            assignedStaffId: assignedStaff.staffId // アサイン先を上書き
          };
          newSlots[indexToUpdate] = updatedSlot; // 配列内の参照を新しいオブジェクトに差し替え

          staffAssignments.get(assignedStaff.staffId)?.push(updatedSlot); 
        }
      }
    }
    
    // 6. 最終的な配列 (手動アサイン + 自動アサイン) でReduxを更新
    dispatch(setRequiredSlots(newSlots));
  };

  // 5. ステップ3 (手動調整) のハンドラ
  // スロットがクリックされたらダイアログを開く
  const handleSlotClick = (slot: IRequiredSlot) => {
    setSelectedSlot(slot);
    // ダイアログを開くときに、過去の助言をクリアする
    dispatch(clearAdvice());
  };

  // ダイアログを閉じる
  const handleCloseDialog = () => {
    setSelectedSlot(null);
  };

  // 担当者を決定するロジック
  const handleAssignStaff = (staffId: string | null) => {
    if (!selectedSlot) return;

    // 1. 現在のスロット配列のコピーを作成
    const newSlots = [...requiredSlots];
    
    // 2. 変更対象のスロットのインデックスを探す
    const slotIndex = newSlots.findIndex(s => s.slotId === selectedSlot.slotId);

    if (slotIndex !== -1) {
      // 3. スロットのアサイン情報を更新 (新しいオブジェクトを作成)
      newSlots[slotIndex] = {
        ...newSlots[slotIndex],
        assignedStaffId: staffId
      };
      
      // 4. Reduxストアを更新
      dispatch(setRequiredSlots(newSlots));
    }

    setSelectedSlot(null); // ダイアログを閉じる
  };

  // 6. AI助言ボタンのハンドラ
  const handleFetchAdvice = () => {
    if (!selectedSlot) return;

    dispatch(fetchAssignmentAdvice({
      targetSlot: selectedSlot,
      allStaff: staffList,
      allPatterns: shiftPatterns,
      burdenData: Array.from(staffBurdenData.values()), // Mapから配列に変換
      allRequiredSlots: requiredSlots, // 月全体のスロットを渡す
    }));
  };


  return (
    <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', display: 'flex', gap: 2, minHeight: 0 }}>
      {/* メインエリア */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="スタッフビュー" />
            <Tab label="勤務枠ビュー" />
          </Tabs>
        </Box>
        
        {/* スタッフビュー */}
        <TabPanel value={tabValue} index={0}>
          <StaffCalendarView 
            onSlotClick={handleSlotClick} // ★★★ ハンドラを渡す
          />
        </TabPanel>
        
        {/* 勤務枠ビュー */}
        <TabPanel value={tabValue} index={1}>
          <WorkSlotCalendarView 
            onSlotClick={handleSlotClick}
            onFixSlotsClick={handleFixSlotsClick}
            onRoughFillClick={handleRoughFillClick}
          />
        </TabPanel>
      </Paper>

      {/* サイドバー (負担の可視化) */}
      <Paper sx={{ width: 300, p: 2, overflow: 'auto' }}>
        <Typography variant="h6" gutterBottom>
          負担の可視化
        </Typography>
        <List dense>
          {/* Map.values() を Array.from() で配列に変換 */}
          {Array.from(staffBurdenData.values()).map(staff => {
            const hourViolation = staff.totalHours > staff.maxHours;
            
            return (
              <ListItem key={staff.staffId} divider>
                <Avatar sx={{ width: 32, height: 32, mr: 2, fontSize: '0.8rem' }}>
                  {staff.name.charAt(0)}
                </Avatar>
                <ListItemText
                  primary={staff.name}
                  secondary={
                    // 修正: Box -> span (HTMLネストエラー対応)
                    <Box 
                      component="span" // <p> の中に <div> が入らないよう <span> に変更
                      sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 0.5 }}
                    >
                      <Chip 
                        label={`計: ${staff.assignmentCount} 回`} 
                        size="small" 
                        variant="outlined" 
                      />
                      <Chip 
                        label={`夜: ${staff.nightShiftCount} 回`} 
                        size="small" 
                        variant="outlined" 
                        color={staff.nightShiftCount > 0 ? 'secondary' : 'default'}
                      />
                      <Chip 
                        label={`土日: ${staff.weekendCount} 回`} 
                        size="small" 
                        variant="outlined" 
                      />
                      <Chip 
                        label={`時: ${staff.totalHours} h`} 
                        size="small" 
                        variant="outlined"
                        color={hourViolation ? 'error' : 'default'}
                      />
                    </Box>
                  }
                  // 修正: secondaryTypographyProps を追加 (HTMLネストエラー対応)
                  secondaryTypographyProps={{ component: 'div' }} // <p> の代わりに <div> を使うよう指定
                />
              </ListItem>
            );
          })}
        </List>
      </Paper>

      {/* 6. 手動調整ダイアログ */}
      <Dialog open={!!selectedSlot} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          手動アサイン (
          {selectedSlot?.date} / {patternMap.get(selectedSlot?.patternId || '')?.name}
          )
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', gap: 2 }}>
          {/* 左側: スタッフ選択リスト */}
          <Box sx={{ flex: 1 }}>
            <List>
              {/* 「未アサイン」に戻すボタン */}
              <ListItemButton onClick={() => handleAssignStaff(null)}>
                <Avatar sx={{ width: 32, height: 32, mr: 2, fontSize: '0.8rem' }}>?</Avatar>
                <ListItemText primary="--- 未アサイン ---" secondary="この枠を空き枠に戻します" />
              </ListItemButton>
              
              {/* スタッフ一覧 */}
              {staffList.map((staff: IStaff) => (
                <ListItemButton 
                  key={staff.staffId} 
                  onClick={() => handleAssignStaff(staff.staffId)}
                  selected={selectedSlot?.assignedStaffId === staff.staffId}
                >
                  <Avatar sx={{ width: 32, height: 32, mr: 2, fontSize: '0.8rem' }}>
                    {staff.name.charAt(0)}
                  </Avatar>
                  <ListItemText 
                    primary={staff.name} 
                    secondary={staffBurdenData.get(staff.staffId)?.assignmentCount + " 回"}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>

          {/* 右側: AI助言エリア */}
          <Box sx={{ flex: 1, borderLeft: '1px solid', borderColor: 'divider', pl: 2 }}>
            <Typography variant="h6" gutterBottom>AI助言</Typography>
            <Button 
              variant="outlined" 
              onClick={handleFetchAdvice} 
              disabled={adviceLoading}
              startIcon={adviceLoading ? <CircularProgress size={16} /> : null}
            >
              {adviceLoading ? '分析中...' : '最適な候補を分析'}
            </Button>

            {/* AIの回答表示エリア */}
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1, minHeight: 150, whiteSpace: 'pre-wrap', overflow: 'auto' }}>
              {adviceError && <Alert severity="error">{adviceError}</Alert>}
              {adviceResult ? (
                <Typography variant="body2">{adviceResult}</Typography>
              ) : (
                !adviceLoading && <Typography variant="body2" color="text.secondary">ボタンを押して助言を求めてください。</Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>閉じる</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default ShiftCalendarPage;