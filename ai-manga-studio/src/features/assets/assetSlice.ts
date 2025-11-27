import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit'; // ← ここを修正しました
import { arrayMove } from '@dnd-kit/sortable';
import type { Asset, AssetCategory, AssetDBItem } from '../../types';
import { dbGetAllAssets, dbSaveAsset, dbDeleteAsset, dbUpdateAssetCategory } from '../../db';
import { v4 as uuidv4 } from 'uuid';

// --- State Definition ---
interface AssetState {
  items: Asset[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
}

const initialState: AssetState = {
  items: [],
  status: 'idle',
};

// --- Async Thunks ---

// 1. 全アセット取得
export const fetchAssets = createAsyncThunk('assets/fetchAssets', async () => {
  const dbItems = await dbGetAllAssets();
  // DBのBlobをURLに変換してState用のオブジェクトを作成
  return dbItems.map(item => ({
    id: item.id,
    url: URL.createObjectURL(item.blob),
    category: item.category,
    createdAt: item.created,
  } as Asset));
});

// 2. アセット追加 (Upload)
export const addAsset = createAsyncThunk(
  'assets/addAsset',
  async ({ file, category }: { file: File; category: AssetCategory }) => {
    const id = uuidv4();
    const dbItem: AssetDBItem = {
      id,
      blob: file,
      category,
      created: Date.now(),
    };
    await dbSaveAsset(dbItem);
    
    // Stateに返すデータ
    return {
      id,
      url: URL.createObjectURL(file),
      category,
      createdAt: dbItem.created,
    } as Asset;
  }
);

// 3. アセット削除
export const deleteAsset = createAsyncThunk('assets/deleteAsset', async (id: string) => {
  await dbDeleteAsset(id);
  return id;
});

// 4. カテゴリ移動 (素材 ⇔ 生成結果)
export const moveAssetCategory = createAsyncThunk(
  'assets/moveCategory',
  async ({ id, newCategory }: { id: string; newCategory: AssetCategory }) => {
    await dbUpdateAssetCategory(id, newCategory);
    return { id, newCategory };
  }
);

// --- Slice ---
const assetSlice = createSlice({
  name: 'assets',
  initialState,
  reducers: {
    // 並び替え (Drag & Drop)
    reorderAssets: (state, action: PayloadAction<{ fromIndex: number; toIndex: number; category: AssetCategory }>) => {
      const { fromIndex, toIndex, category } = action.payload;
      
      // 対象カテゴリーのアイテムだけ抽出して並び替え
      const categoryItems = state.items.filter(i => i.category === category);
      const otherItems = state.items.filter(i => i.category !== category);
      
      if (categoryItems[fromIndex] && categoryItems[toIndex]) {
        const reordered = arrayMove(categoryItems, fromIndex, toIndex);
        // 他のカテゴリーのアイテムと再結合（本来はDB側でも順序を保存すべきですが、今回はStateのみ更新）
        state.items = [...reordered, ...otherItems]; 
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchAssets.pending, (state) => { state.status = 'loading'; })
      .addCase(fetchAssets.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // 作成日順などで初期ソートしても良いが、並び替え機能があるのでそのまま
        state.items = action.payload.sort((a, b) => b.createdAt - a.createdAt);
      })
      // Add
      .addCase(addAsset.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      // Delete
      .addCase(deleteAsset.fulfilled, (state, action) => {
        state.items = state.items.filter(a => a.id !== action.payload);
      })
      // Move Category
      .addCase(moveAssetCategory.fulfilled, (state, action) => {
        const item = state.items.find(i => i.id === action.payload.id);
        if (item) item.category = action.payload.newCategory;
      });
  },
});

export const { reorderAssets } = assetSlice.actions;
export default assetSlice.reducer;