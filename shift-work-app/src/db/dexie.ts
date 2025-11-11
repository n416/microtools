import Dexie, { type Table } from 'dexie';

// --- 型定義 (フェーズ7の洗い出しに基づき全面的に修正) ---

// スタッフの恒久的な制約 (IStaff内でネストして使用)
export interface IStaffConstraints {
  // 1. 時間・日付に関する制約
  maxConsecutiveDays: number;    // 最大連勤日数
  minIntervalHours: number;      // 勤務間インターバル
  maxTotalHoursPerWeek: number;  // 週の最大労働時間 (※ロジック未実装)
  maxTotalHoursPerMonth: number; // 月の最大労働時間 (※ロジック未実装)
  maxWeekendShifts: number;      // 月の土日勤務上限 (※ロジック未実装)
  unavailableWeekdays: number[];     // 毎週NGな曜日 (0=日, 1=月... 例: [3])
  unavailableDatesOfMonth: number[];   // 毎月NGな日付 (例: [10, 20])
  unavailableNthWeekdays: { day: number; week: number }[]; // 第N X曜日 (例: [{day: 3, week: 1}])

  // 2. 勤務パターンに関する制約
  unavailablePatterns: string[];   // 勤務不可なパターン (例: ["P02"])
  maxPatternCountPerMonth: { patternId: string; max: number }[]; // パターン回数上限 (例: [{patternId: "P02", max: 5}])
  maxConsecutivePattern: { patternId: string; max: number }[]; // パターン連勤上限 (※ロジック未実装)
  invalidPatternTransitions: { from: string; to: string }[]; // NGな勤務遷移 (※ロジック未実装)

  // 3. スタッフ・スキルに関する制約
  avoidStaffIds: string[];     // 同時勤務NGなスタッフID (例: ["s002"])
  requireStaffIds: string[];   // 同時勤務必須なスタッフID (※ロジック未実装)
  
  // 4. 法的・属性的制約
  isMinor: boolean; // 18歳未満フラグ (※ロジック未実装)
}

export interface IStaff {
  staffId: string;
  employmentType: 'FullTime' | 'PartTime';
  name: string;
  skills: string[]; // スキル (例: ["Leader"])
  constraints: IStaffConstraints; // 恒久的な制約
  memo?: string;    // Geminiが読む自然言語メモ
}

export interface IShiftPattern {
  patternId: string;
  name: string;
  startTime: string;        
  endTime: string;          
  crossesMidnight: boolean; 
  isNightShift: boolean;    
  durationHours: number; // ★★★ 労働時間（時間/週 計算用に追加）
}

export interface IRequiredStaffing {
  id?: number;
  date: string | null;
  patternId: string;
  minStaff: number;
  requiredRole: string[]; // 必須の役割 (例: ["FullTime"])
  requiredSkills: string[]; // ★★★ 必須のスキル (例: ["Leader"])
}

export interface IAssignment {
  id?: number;
  date: string;
  staffId: string;
  patternId: string;
}
// --- ここまで型定義 ---

export class ShiftWorkDB extends Dexie {
  staffList!: Table<IStaff>;
  shiftPatterns!: Table<IShiftPattern>;
  requiredStaffing!: Table<IRequiredStaffing>;
  assignments!: Table<IAssignment>;

  constructor() {
    super('ShiftWorkAppDB');
    // DBバージョンを上げ、スキーマを更新
    this.version(2).stores({
      staffList: '&staffId, employmentType, name, *skills',
      shiftPatterns: '&patternId, name',
      requiredStaffing: '++id, date, patternId, [date+patternId], *requiredSkills', // requiredSkills をインデックスに追加
      assignments: '++id, [date+staffId], [date+patternId], staffId, patternId'
    }).upgrade(tx => {
      // v1 -> v2 へのアップグレード (既存データがあれば移行処理を書くが、今回はモック再投入のため不要)
      console.log("Upgrading database to version 2...");
    });
    
    // v1 (旧スキーマ) も定義しておく (初回インストール用)
    this.version(1).stores({
      staffList: '&staffId, employmentType, name, *skills',
      shiftPatterns: '&patternId, name',
      requiredStaffing: '++id, date, patternId, [date+patternId]',
      assignments: '++id, [date+staffId], [date+patternId], staffId, patternId'
    });
  }
}

export const db = new ShiftWorkDB();