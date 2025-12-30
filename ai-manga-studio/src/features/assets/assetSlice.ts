import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { arrayMove } from '@dnd-kit/sortable';
import type { Asset, AssetCategory, AssetDBItem } from '../../types';
import { 
  dbGetAllAssets, dbSaveAsset, dbDeleteAsset, 
  dbUpdateAssetCategory, dbDeleteAssets 
} from '../../db';
import { v4 as uuidv4 } from 'uuid';

interface AssetState {
  items: Asset[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
}

const initialState: AssetState = {
  items: [],
  status: 'idle',
};

// --- Async Thunks ---

export const fetchAssets = createAsyncThunk('assets/fetchAssets', async () => {
  const dbItems = await dbGetAllAssets();
  return dbItems.map(item => ({
    id: item.id,
    url: URL.createObjectURL(item.blob),
    category: item.category,
    mimeType: item.blob.type, // ★DBから復元
    createdAt: item.created,
  } as Asset));
});

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
    
    return {
      id,
      url: URL.createObjectURL(file),
      category,
      mimeType: file.type, // ★新規追加時
      createdAt: dbItem.created,
    } as Asset;
  }
);

export const deleteAsset = createAsyncThunk('assets/deleteAsset', async (id: string) => {
  await dbDeleteAsset(id);
  return id;
});

export const deleteMultipleAssets = createAsyncThunk(
  'assets/deleteMultiple',
  async (ids: string[]) => {
    await dbDeleteAssets(ids);
    return ids;
  }
);

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
    reorderAssets: (state, action: PayloadAction<{ fromIndex: number; toIndex: number; category: AssetCategory }>) => {
      const { fromIndex, toIndex, category } = action.payload;
      const categoryItems = state.items.filter(i => i.category === category);
      const otherItems = state.items.filter(i => i.category !== category);
      
      if (categoryItems[fromIndex] && categoryItems[toIndex]) {
        const reordered = arrayMove(categoryItems, fromIndex, toIndex);
        state.items = [...reordered, ...otherItems]; 
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAssets.pending, (state) => { state.status = 'loading'; })
      .addCase(fetchAssets.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload.sort((a, b) => b.createdAt - a.createdAt);
      })
      .addCase(addAsset.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })
      .addCase(deleteAsset.fulfilled, (state, action) => {
        state.items = state.items.filter(a => a.id !== action.payload);
      })
      .addCase(deleteMultipleAssets.fulfilled, (state, action) => {
        const idsToRemove = new Set(action.payload);
        state.items = state.items.filter(a => !idsToRemove.has(a.id));
      })
      .addCase(moveAssetCategory.fulfilled, (state, action) => {
        const item = state.items.find(i => i.id === action.payload.id);
        if (item) item.category = action.payload.newCategory;
      });
  },
});

export const { reorderAssets } = assetSlice.actions;
export default assetSlice.reducer;
