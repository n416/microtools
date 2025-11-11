import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { db, IShiftPattern } from '../db/dexie'; // (IShiftPattern と db をインポート)

// 新規パターン追加Thunk
export const addNewPattern = createAsyncThunk(
  'pattern/addNewPattern',
  async (newPatternData: Omit<IShiftPattern, 'patternId'>, { rejectWithValue }) => {
    try {
      // 1. ユニークIDを生成 (簡易的に P + タイムスタンプ)
      const patternId = `P${Date.now()}`;
      const patternToAdd: IShiftPattern = {
        ...newPatternData,
        patternId: patternId,
      };

      // 2. DBに追加
      await db.shiftPatterns.add(patternToAdd);

      // 3. Redux Stateに反映するため、完成したパターンデータを返す
      return patternToAdd;

    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);

// パターン削除Thunk
export const deletePattern = createAsyncThunk(
  'pattern/deletePattern',
  async (patternId: string, { rejectWithValue }) => {
    try {
      // 1. DBから削除
      await db.shiftPatterns.delete(patternId);
      
      // (※TODO: このパターンが割り当てられているアサイン結果(assignments)や、
      // 　 スタッフ制約(constraints.unavailablePatterns)からも削除する必要がある)

      // 2. Redux Stateに反映するため、削除したIDを返す
      return patternId;

    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);

// ★★★ パターン更新Thunk (ここから) ★★★
export const updatePattern = createAsyncThunk(
  'pattern/updatePattern',
  async (pattern: IShiftPattern, { rejectWithValue }) => {
    try {
      // 1. DBを更新 (putは指定したIDのデータを丸ごと置き換える)
      await db.shiftPatterns.put(pattern);
      
      // 2. Redux Stateに反映するため、更新後のパターンデータを返す
      return pattern;

    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);
// ★★★ パターン更新Thunk (ここまで) ★★★


interface PatternState {
  patterns: IShiftPattern[]; // any[] -> IShiftPattern[]
  loading: boolean;
  error: string | null;
}

const initialState: PatternState = {
  patterns: [],
  loading: false,
  error: null,
};

const patternSlice = createSlice({
  name: 'pattern',
  initialState,
  reducers: {
    setPatterns: (state, action: PayloadAction<IShiftPattern[]>) => {
      state.patterns = action.payload;
    },
  },
  // 非同期アクションのハンドラを追加
  extraReducers: (builder) => {
    builder
      // (addNewPattern)
      .addCase(addNewPattern.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addNewPattern.fulfilled, (state, action) => {
        state.patterns.push(action.payload);
        state.loading = false;
      })
      .addCase(addNewPattern.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // (deletePattern)
      .addCase(deletePattern.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deletePattern.fulfilled, (state, action) => {
        state.patterns = state.patterns.filter(p => p.patternId !== action.payload);
        state.loading = false;
      })
      .addCase(deletePattern.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // ★★★ updatePattern のハンドラを追加 ★★★
      .addCase(updatePattern.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updatePattern.fulfilled, (state, action) => {
        // ストアの配列内の該当パターンを置き換え
        const index = state.patterns.findIndex(p => p.patternId === action.payload.patternId);
        if (index !== -1) {
          state.patterns[index] = action.payload;
        }
        state.loading = false;
      })
      .addCase(updatePattern.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { setPatterns } = patternSlice.actions;
export default patternSlice.reducer;