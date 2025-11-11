import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { db, IRequiredStaffing } from '../db/dexie'; // (IRequiredStaffing と db をインポート)

// ★★★ 新規 必要人数定義 追加Thunk (ここから) ★★★
export const addNewRequirement = createAsyncThunk(
  'requirement/addNewRequirement',
  async (newReqData: Omit<IRequiredStaffing, 'id'>, { rejectWithValue }) => {
    try {
      // 1. DBに追加 (idは auto-increment のため不要)
      const addedId = await db.requiredStaffing.add(newReqData);

      // 2. Redux Stateに反映するため、完成したデータを返す (IDも付与)
      const requirementToAdd: IRequiredStaffing = {
        ...newReqData,
        id: addedId,
      };
      return requirementToAdd;

    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);
// ★★★ 新規 必要人数定義 追加Thunk (ここまで) ★★★

// ★★★ 必要人数定義 削除Thunk (ここから) ★★★
export const deleteRequirement = createAsyncThunk(
  'requirement/deleteRequirement',
  async (id: number, { rejectWithValue }) => {
    try {
      // 1. DBから削除
      await db.requiredStaffing.delete(id);
      
      // (※TODO: この定義が削除された場合、既存の「枠FIX」結果(requiredSlots)も影響を受けるか検討が必要)

      // 2. Redux Stateに反映するため、削除したIDを返す
      return id;

    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);
// ★★★ 必要人数定義 削除Thunk (ここまで) ★★★


interface RequirementState {
  requirements: IRequiredStaffing[]; // any[] -> IRequiredStaffing[]
  loading: boolean;
  error: string | null;
}

const initialState: RequirementState = {
  requirements: [],
  loading: false,
  error: null,
};

const requirementSlice = createSlice({
  name: 'requirement',
  initialState,
  reducers: {
    // ★★★ ここが修正点です ★★★
    // PayloadCAction -> PayloadAction
    setRequirements: (state, action: PayloadAction<IRequiredStaffing[]>) => {
      state.requirements = action.payload;
    },
  },
  // ★★★ 非同期アクションのハンドラを追加 ★★★
  extraReducers: (builder) => {
    builder
      // (addNewRequirement)
      .addCase(addNewRequirement.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addNewRequirement.fulfilled, (state, action) => {
        state.requirements.push(action.payload);
        state.loading = false;
      })
      .addCase(addNewRequirement.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // (deleteRequirement)
      .addCase(deleteRequirement.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteRequirement.fulfilled, (state, action) => {
        state.requirements = state.requirements.filter(r => r.id !== action.payload);
        state.loading = false;
      })
      .addCase(deleteRequirement.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { setRequirements } = requirementSlice.actions;
export default requirementSlice.reducer;