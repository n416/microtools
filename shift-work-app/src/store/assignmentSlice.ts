import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { IStaff, IShiftPattern, db } from '../db/dexie'; // (DBと型をインポート)
import { GeminiApiClient } from '../api/geminiApiClient'; // (APIクライアントをインポート)

// ステップ0 (枠FIX) で生成される「アサイン対象スロット」の型
export interface IRequiredSlot {
  slotId: string; // (例: 2025-11-01_P01_1)
  date: string;
  patternId: string;
  requiredRole: string[];
  requiredSkills: string[];
  assignedStaffId: string | null; // (ステップ2, 3 で埋まる)
}

// ★★★ AI助言Thunk (ここから) ★★★

// AIに渡すデータの型定義
interface FetchAdviceArgs {
  targetSlot: IRequiredSlot;
  allStaff: IStaff[];
  allPatterns: IShiftPattern[];
  burdenData: any; // (簡易的に any)
  // ★★★ 修正: 月全体の状況を渡す ★★★
  allRequiredSlots: IRequiredSlot[]; 
}

export const fetchAssignmentAdvice = createAsyncThunk(
  'assignment/fetchAdvice',
  async (args: FetchAdviceArgs, { rejectWithValue }) => {
    // ★★★ 修正: allRequiredSlots を受け取る ★★★
    const { targetSlot, allStaff, allPatterns, burdenData, allRequiredSlots } = args;

    const gemini = new GeminiApiClient();
    if (!gemini.isAvailable) {
      return rejectWithValue('Gemini APIが設定されていません。');
    }

    const targetPattern = allPatterns.find(p => p.patternId === targetSlot.patternId);
    
    // ★★★ 修正: プロンプトを全面的に刷新 ★★★
    const prompt = `あなたは勤務スケジュールアシスタントです。管理者が手動でアサインを調整しようとしています。
以下の状況を分析し、管理者が**次に行うべきアクション（ネゴシエーション）**を具体的に助言してください。

# 1. 調整対象の枠 (スロット)
- 日付: ${targetSlot.date}
- 勤務: ${targetPattern?.name || targetSlot.patternId}
- 必須要件: ${(targetSlot.requiredRole || []).concat(targetSlot.requiredSkills || []).join(', ') || '特になし'}
- 現在のアサイン: ${targetSlot.assignedStaffId || '未アサイン'}

# 2. スタッフリストと現在の負担状況
${JSON.stringify(burdenData, null, 2)}

# 3. スタッフ全員の制約とメモ (最重要)
${JSON.stringify(allStaff.map(s => ({ 
  staffId: s.staffId, 
  name: s.name, 
  constraints: s.constraints, 
  memo: s.memo 
})), null, 2)}

# 4. 月全体のアサイン状況 (参考)
(※データ量削減のため、アサイン済みのスロットのみ抜粋)
${JSON.stringify(allRequiredSlots.filter(s => s.assignedStaffId), null, 2)}

# 指示 (最重要)
1. **包括的な分析**: この枠（${targetSlot.date}）だけでなく、**他の日付のスロットとの交換**も含めて、最も公平で現実的な解決策（推奨アサイン）を提案してください。
2. **ネゴシエーション支援**: 提案を採用する場合、管理者がそのスタッフに**依頼（ネゴシエーション）するための具体的なメッセージ文例**も作成してください。
3. **制約の扱い**: 「同時勤務NG」「夜勤不可」などの制約は**レベル2（警告）**として扱います。「仕事なのでお願いできる」前提で、その際の「頼み方」を工夫してください。
4. **形式**: 「推奨: [スタッフ名]」「理由: [なぜその人か]」「ネゴ文例: [依頼メッセージ]」の形式で、自然言語で回答してください。`;

    try {
      const resultText = await gemini.generateContent(prompt);
      return resultText;
    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);
// ★★★ AI助言Thunk (ここまで) ★★★


interface AssignmentState {
  assignments: any[]; // (DBのIAssignmentが入る)
  requiredSlots: IRequiredSlot[]; // (ステップ0で生成される枠)
  // AI助言用のState
  adviceLoading: boolean;
  adviceError: string | null;
  adviceResult: string | null;
}

const initialState: AssignmentState = {
  assignments: [],
  requiredSlots: [], // (初期値は空)
  adviceLoading: false,
  adviceError: null,
  adviceResult: null,
};

const assignmentSlice = createSlice({
  name: 'assignment',
  initialState,
  reducers: {
    setAssignments: (state, action: PayloadAction<any[]>) => {
      state.assignments = action.payload;
    },
    // ステップ0のロジックで生成されたスロットをセットするReducer
    setRequiredSlots: (state, action: PayloadAction<IRequiredSlot[]>) => {
      state.requiredSlots = action.payload;
    },
    // 助言結果をクリアするReducer
    clearAdvice: (state) => {
      state.adviceLoading = false;
      state.adviceError = null;
      state.adviceResult = null;
    }
  },
  // AI助言Thunkのステータスをハンドリング
  extraReducers: (builder) => {
    builder
      .addCase(fetchAssignmentAdvice.pending, (state) => {
        state.adviceLoading = true;
        state.adviceError = null;
        state.adviceResult = null;
      })
      .addCase(fetchAssignmentAdvice.fulfilled, (state, action) => {
        state.adviceLoading = false;
        state.adviceResult = action.payload;
      })
      .addCase(fetchAssignmentAdvice.rejected, (state, action) => {
        state.adviceLoading = false;
        state.adviceError = action.payload as string;
      });
  }
});

export const { setAssignments, setRequiredSlots, clearAdvice } = assignmentSlice.actions;
export default assignmentSlice.reducer;