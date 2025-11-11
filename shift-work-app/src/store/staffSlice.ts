import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { db, IStaff, IStaffConstraints } from '../db/dexie'; // (IStaff もインポート)
import { GeminiApiClient } from '../api/geminiApiClient'; // APIクライアント
import { extractJson } from '../utils/jsonExtractor'; // 作成した抽出関数

// 渡されるデータの型定義 (TypeScript用)
interface ParseConstraintsArgs {
  staffId: string;
  memo: string;
  shiftPatterns: { patternId: string; name: string }[];
  currentMonthInfo: { month: string; dayOfWeekOn10th: string };
}

// createAsyncThunk (制約解釈)
export const parseAndSaveConstraints = createAsyncThunk(
  'staff/parseConstraints',
  async (args: ParseConstraintsArgs, { rejectWithValue, getState }) => {
    const { staffId, memo, shiftPatterns, currentMonthInfo } = args;
    
    const allStaff = (getState() as any).staff.staff; 
    const otherStaff = allStaff.filter((s: any) => s.staffId !== staffId).map((s: any) => ({ staffId: s.staffId, name: s.name }));

    const gemini = new GeminiApiClient();
    if (!gemini.isAvailable) {
      return rejectWithValue('Gemini APIが設定されていません。');
    }

    const prompt = `あなたは勤務スケジュールアシスタントです。以下の自然言語のメモを解釈し、指定されたJSON形式の恒久的制約データに変換してください。

# 勤務パターンリスト (解釈の参考に)
${JSON.stringify(shiftPatterns)}

# 他のスタッフリスト (解釈の参考に)
${JSON.stringify(otherStaff)}

# カレンダー (解釈の参考に)
- 現在の月: ${currentMonthInfo.month} (例: 2025-11)
- 10日は ${currentMonthInfo.dayOfWeekOn10th} です。 (例: 月曜日)

# ユーザーのメモ
${memo}

# 出力JSONフォーマット (この形式以外は絶対に出力しない)
{
  "unavailableWeekdays": [0, 1, ...],
  "unavailableDatesOfMonth": [1, 2, ...],
  "unavailableNthWeekdays": [{"day": 0, "week": 1}, ...],
  "unavailablePatterns": ["P01", ...],
  "maxPatternCountPerMonth": [{"patternId": "P01", "max": 5}, ...],
  "avoidStaffIds": ["s002", ...]
}

# 指示
- メモが解釈できない場合や、JSONフォーマットにないルール（例：「最大5連勤」）は、JSONに含めないでください。
- 曜日は数値 (0=日曜, 1=月曜, 2=火曜, 3=水曜, 4=木曜, 5=金曜, 6=土曜) で表現してください。
- 「毎週水曜は休み」は "unavailableWeekdays": [3] と解釈してください。
- 「第一月曜は休み」は "unavailableNthWeekdays": [{"day": 1, "week": 1}] と解釈してください。
- 「夜勤は不可」は、勤務パターンリストを参考に "unavailablePatterns": ["P02"] (夜勤のID) と解釈してください。
- 「夜勤は月2回まで」は "maxPatternCountPerMonth": [{"patternId": "P02", "max": 2}] と解釈してください。
- 「Bさんと一緒はNG」は、他のスタッフリストを参考に "avoidStaffIds": ["s002"] (BさんのID) と解釈してください。
- 「10日は休み」のような特定の日付の希望は、恒久的な制約ではないため *無視* してください。
- JSONオブジェクトのみを出力してください。`;

    try {
      const resultText = await gemini.generateContent(prompt);
      // AIの解釈結果 (AIが解釈した部分のみ)
      const parsedPartialConstraints = extractJson(resultText);

      // 1. DBを更新 (★修正: 既存の制約にマージする)
      const existingStaff = await db.staffList.get(staffId);
      if (!existingStaff) {
        throw new Error('対象のスタッフがDBに見つかりません。');
      }

      // 既存の制約 (maxConsecutiveDaysなど) とAIの解釈結果をマージ
      const newConstraints: IStaffConstraints = {
        ...existingStaff.constraints, // maxConsecutiveDays 等を維持
        
        // AIが解釈したフィールドを上書き (未定義の場合は既存の値を維持、または空配列)
        unavailableWeekdays: parsedPartialConstraints.unavailableWeekdays || existingStaff.constraints.unavailableWeekdays,
        unavailableDatesOfMonth: parsedPartialConstraints.unavailableDatesOfMonth || existingStaff.constraints.unavailableDatesOfMonth,
        unavailableNthWeekdays: parsedPartialConstraints.unavailableNthWeekdays || existingStaff.constraints.unavailableNthWeekdays,
        unavailablePatterns: parsedPartialConstraints.unavailablePatterns || existingStaff.constraints.unavailablePatterns,
        maxPatternCountPerMonth: parsedPartialConstraints.maxPatternCountPerMonth || existingStaff.constraints.maxPatternCountPerMonth,
        avoidStaffIds: parsedPartialConstraints.avoidStaffIds || existingStaff.constraints.avoidStaffIds,
      };

      await db.staffList.update(staffId, {
        constraints: newConstraints
      });
      
      // 2. Redux Stateに反映するため、結果を返す
      return { staffId, parsedConstraints: newConstraints }; // マージ後の完全な制約を返す

    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);

// 新規スタッフ追加Thunk
export const addNewStaff = createAsyncThunk(
  'staff/addNewStaff',
  async (newStaffData: Omit<IStaff, 'staffId'>, { rejectWithValue }) => {
    try {
      // 1. ユニークIDを生成 (簡易的にタイムスタンプ)
      const staffId = `s${Date.now()}`;
      const staffToAdd: IStaff = {
        ...newStaffData,
        staffId: staffId,
      };

      // 2. DBに追加
      await db.staffList.add(staffToAdd);

      // 3. Redux Stateに反映するため、完成したスタッフデータを返す
      return staffToAdd;

    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);

// スタッフ削除Thunk
export const deleteStaff = createAsyncThunk(
  'staff/deleteStaff',
  async (staffId: string, { rejectWithValue }) => {
    try {
      // 1. DBから削除
      await db.staffList.delete(staffId);
      
      // (※TODO: このスタッフが割り当てられているアサイン結果(assignments)もクリアする必要がある)

      // 2. Redux Stateに反映するため、削除したIDを返す
      return staffId;

    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);

// ★★★ スタッフ更新Thunk (ここから) ★★★
export const updateStaff = createAsyncThunk(
  'staff/updateStaff',
  async (staff: IStaff, { rejectWithValue }) => {
    try {
      // 1. DBを更新 (putは指定したIDのデータを丸ごと置き換える)
      await db.staffList.put(staff);
      
      // 2. Redux Stateに反映するため、更新後のスタッフデータを返す
      return staff;

    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);
// ★★★ スタッフ更新Thunk (ここまで) ★★★


// --- スライス本体 ---
interface StaffState {
  staff: IStaff[]; // any[] -> IStaff[] に修正
  loading: boolean;
  error: string | null;
}

const initialState: StaffState = {
  staff: [],
  loading: false,
  error: null,
};

const staffSlice = createSlice({
  name: 'staff',
  initialState,
  reducers: {
    setStaffList: (state, action) => {
      state.staff = action.payload;
    },
  },
  // 非同期アクションのステータスに応じてStateを更新
  extraReducers: (builder) => {
    builder
      // (parseConstraints)
      .addCase(parseAndSaveConstraints.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(parseAndSaveConstraints.fulfilled, (state, action) => {
        const index = state.staff.findIndex((s) => s.staffId === action.payload.staffId);
        if (index !== -1) {
          state.staff[index].constraints = action.payload.parsedConstraints;
        }
        state.loading = false;
      })
      .addCase(parseAndSaveConstraints.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // (addNewStaff)
      .addCase(addNewStaff.pending, (state) => {
        state.loading = true; // (共有のローディングを使用)
        state.error = null;
      })
      .addCase(addNewStaff.fulfilled, (state, action) => {
        state.staff.push(action.payload); // ストアの配列に新しいスタッフを追加
        state.loading = false;
      })
      .addCase(addNewStaff.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // (deleteStaff)
      .addCase(deleteStaff.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteStaff.fulfilled, (state, action) => {
        // ストアの配列から削除されたスタッフを除外
        state.staff = state.staff.filter(s => s.staffId !== action.payload);
        state.loading = false;
      })
      .addCase(deleteStaff.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // ★★★ updateStaff のハンドラを追加 ★★★
      .addCase(updateStaff.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateStaff.fulfilled, (state, action) => {
        // ストアの配列内の該当スタッフを置き換え
        const index = state.staff.findIndex(s => s.staffId === action.payload.staffId);
        if (index !== -1) {
          state.staff[index] = action.payload;
        }
        state.loading = false;
      })
      .addCase(updateStaff.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { setStaffList } = staffSlice.actions;
export default staffSlice.reducer;