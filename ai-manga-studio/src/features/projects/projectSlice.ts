import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Project, StoryBlock } from '../../types';
import { dbGetAllProjects, dbSaveProject, dbDeleteProject } from '../../db';
import { v4 as uuidv4 } from 'uuid';

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

// 1. 全プロジェクト取得 (マイグレーション機能付き)
export const fetchProjects = createAsyncThunk('projects/fetchProjects', async () => {
  const projects = await dbGetAllProjects();
  
  // 旧データ (pages) を新データ (storyboard) にマイグレーション
  return projects.map((p: any) => {
    if (p.pages && !p.storyboard) {
      const storyboard: StoryBlock[] = p.pages.map((page: any) => ({
        ...page,
        id: uuidv4(),
        type: 'image',
        assignedAssetId: page.assignedAssetId
      }));
      
      // 不要になったpagesを削除してProject型にキャスト
      const { pages, ...rest } = p;
      return {
        ...rest,
        storyboard
      } as Project;
    }
    return p as Project;
  });
});

// 2. プロジェクトの新規作成または更新
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

// 3. プロジェクト削除
export const deleteProject = createAsyncThunk(
  'projects/deleteProject',
  async (id: string) => {
    await dbDeleteProject(id);
    return id;
  }
);

// 4. プロジェクト内の画像割り当て更新 (Block ID対応)
export const updateProjectAsset = createAsyncThunk(
  'projects/updateAsset',
  async (
    { projectId, type, blockId, assetId }: { projectId: string, type: 'cover' | 'block', blockId?: string, assetId: string }, 
    { getState }
  ) => {
    const state = getState() as { projects: { items: Project[] } };
    const project = state.projects.items.find(p => p.id === projectId);
    
    if (!project) throw new Error("Project not found");

    const updatedProject = { ...project, updatedAt: Date.now() };
    
    if (type === 'cover') {
      updatedProject.coverAssetId = assetId;
    } else if (type === 'block' && blockId) {
      updatedProject.storyboard = updatedProject.storyboard.map(b => {
        if (b.id === blockId) {
          return { ...b, assignedAssetId: assetId };
        }
        return b;
      });
    }

    await dbSaveProject(updatedProject);
    return updatedProject;
  }
);

// --- Slice ---
const projectSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setCurrentProject: (state, action: PayloadAction<Project | null>) => {
      state.currentProject = action.payload;
    },
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
        state.items.sort((a, b) => b.updatedAt - a.updatedAt);
        
        if (state.currentProject?.id === action.payload.id) {
          state.currentProject = action.payload;
        }
      })
      // Delete
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.items = state.items.filter(p => p.id !== action.payload);
        if (state.currentProject?.id === action.payload) {
          state.currentProject = null;
        }
      })
      // Asset Update
      .addCase(updateProjectAsset.fulfilled, (state, action) => {
        const index = state.items.findIndex(p => p.id === action.payload.id);
        if (index >= 0) {
          state.items[index] = action.payload;
        }
        if (state.currentProject?.id === action.payload.id) {
          state.currentProject = action.payload;
        }
      });
  },
});

export const { setCurrentProject, addProjectTemporary } = projectSlice.actions;
export default projectSlice.reducer;
