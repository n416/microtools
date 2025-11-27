import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Project } from '../../types';
import { dbGetAllProjects, dbSaveProject } from '../../db';

// --- State Definition ---
interface ProjectState {
  items: Project[];
  currentProject: Project | null;
  status: 'idle' | 'loading' | 'succeeded';
}

const initialState: ProjectState = {
  items: [],
  currentProject: null,
  status: 'idle',
};

// --- Async Thunks ---

// 1. 全プロジェクト取得
export const fetchProjects = createAsyncThunk('projects/fetchProjects', async () => {
  return await dbGetAllProjects();
});

// 2. プロジェクトの新規作成または更新（メタデータやページ構成など）
export const createOrUpdateProject = createAsyncThunk(
  'projects/saveProject',
  async (project: Project) => {
    const now = Date.now();
    const toSave = { ...project, updatedAt: now };
    if (!toSave.createdAt) toSave.createdAt = now;
    
    await dbSaveProject(toSave);
    return toSave;
  }
);

// 3. プロジェクト内の画像割り当て更新（表紙またはページ）
export const updateProjectAsset = createAsyncThunk(
  'projects/updateAsset',
  async (
    { projectId, type, pageIndex, assetId }: { projectId: string, type: 'cover' | 'page', pageIndex?: number, assetId: string }, 
    { getState }
  ) => {
    // ReduxのStateから対象プロジェクトを探す
    const state = getState() as { projects: { items: Project[] } };
    const project = state.projects.items.find(p => p.id === projectId);
    
    if (!project) throw new Error("Project not found");

    // オブジェクトをコピーして更新
    const updatedProject = { ...project, updatedAt: Date.now() };
    
    if (type === 'cover') {
      updatedProject.coverAssetId = assetId;
    } else if (type === 'page' && typeof pageIndex === 'number') {
      // pages配列も新しい配列としてコピー
      updatedProject.pages = [...updatedProject.pages];
      // 対象ページを更新
      updatedProject.pages[pageIndex] = {
        ...updatedProject.pages[pageIndex],
        assignedAssetId: assetId
      };
    }

    // DB保存
    await dbSaveProject(updatedProject);
    return updatedProject;
  }
);

// --- Slice ---
const projectSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    // 選択中のプロジェクトを変更
    setCurrentProject: (state, action: PayloadAction<Project | null>) => {
      state.currentProject = action.payload;
    },
    // 一時的にStateに追加（DB保存前など）
    addProjectTemporary: (state, action: PayloadAction<Project>) => {
      state.items.unshift(action.payload);
      state.currentProject = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.items = action.payload.sort((a, b) => b.updatedAt - a.updatedAt);
        state.status = 'succeeded';
      })
      // Save / Update
      .addCase(createOrUpdateProject.fulfilled, (state, action) => {
        const index = state.items.findIndex(p => p.id === action.payload.id);
        if (index >= 0) {
          state.items[index] = action.payload;
        } else {
          state.items.unshift(action.payload);
        }
        // 更新順にソート
        state.items.sort((a, b) => b.updatedAt - a.updatedAt);
        
        // カレントプロジェクトも同期
        if (state.currentProject?.id === action.payload.id) {
          state.currentProject = action.payload;
        }
      })
      // Asset Update (画像割り当て)
      .addCase(updateProjectAsset.fulfilled, (state, action) => {
        const index = state.items.findIndex(p => p.id === action.payload.id);
        if (index >= 0) {
          state.items[index] = action.payload;
        }
        // カレントプロジェクトも同期
        if (state.currentProject?.id === action.payload.id) {
          state.currentProject = action.payload;
        }
      });
  },
});

export const { setCurrentProject, addProjectTemporary } = projectSlice.actions;
export default projectSlice.reducer;