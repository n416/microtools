import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Project, StoryBlock, DirectorAttributes } from '../../types';
import { dbGetAllProjects, dbSaveProject, dbDeleteProject } from '../../db';
import { v4 as uuidv4 } from 'uuid';

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

export const fetchProjects = createAsyncThunk('projects/fetchProjects', async () => {
  const projects = await dbGetAllProjects();
  return projects.map((p: any) => {
    // Migration: pages -> storyboard
    if (p.pages && !p.storyboard) {
      const storyboard: StoryBlock[] = p.pages.map((page: any) => ({
        ...page,
        id: uuidv4(),
        type: 'image',
        assignedAssetId: page.assignedAssetId
      }));
      const { pages, ...rest } = p;
      return { ...rest, storyboard } as Project;
    }
    return p as Project;
  });
});

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

export const deleteProject = createAsyncThunk(
  'projects/deleteProject',
  async (id: string) => {
    await dbDeleteProject(id);
    return id;
  }
);

// --- Storyboard Manipulation Thunks ---

export const addStoryBlock = createAsyncThunk(
  'projects/addStoryBlock',
  async ({ projectId, index, block }: { projectId: string, index: number, block: StoryBlock }, { getState }) => {
    const state = getState() as { projects: { items: Project[] } };
    const project = state.projects.items.find(p => p.id === projectId);
    if (!project) throw new Error("Project not found");

    const newStoryboard = [...project.storyboard];
    newStoryboard.splice(index, 0, block);

    const updatedProject = { ...project, storyboard: newStoryboard, updatedAt: Date.now() };
    await dbSaveProject(updatedProject);
    return updatedProject;
  }
);

export const removeStoryBlock = createAsyncThunk(
  'projects/removeStoryBlock',
  async ({ projectId, blockId }: { projectId: string, blockId: string }, { getState }) => {
    const state = getState() as { projects: { items: Project[] } };
    const project = state.projects.items.find(p => p.id === projectId);
    if (!project) throw new Error("Project not found");

    const updatedProject = { 
      ...project, 
      storyboard: project.storyboard.filter(b => b.id !== blockId),
      updatedAt: Date.now() 
    };
    await dbSaveProject(updatedProject);
    return updatedProject;
  }
);

export const updateBlockPrompt = createAsyncThunk(
  'projects/updateBlockPrompt',
  async ({ projectId, blockId, prompt }: { projectId: string, blockId: string, prompt: string }, { getState }) => {
    const state = getState() as { projects: { items: Project[] } };
    const project = state.projects.items.find(p => p.id === projectId);
    if (!project) throw new Error("Project not found");

    const updatedProject = {
      ...project,
      storyboard: project.storyboard.map(b => b.id === blockId && b.type === 'video' ? { ...b, prompt } : b),
      updatedAt: Date.now()
    };
    await dbSaveProject(updatedProject);
    return updatedProject;
  }
);

export const updateBlockAttributes = createAsyncThunk(
  'projects/updateBlockAttributes',
  async ({ projectId, blockId, attributes, prompt }: { projectId: string, blockId: string, attributes: DirectorAttributes, prompt?: string }, { getState }) => {
    const state = getState() as { projects: { items: Project[] } };
    const project = state.projects.items.find(p => p.id === projectId);
    if (!project) throw new Error("Project not found");

    const updatedProject = {
      ...project,
      storyboard: project.storyboard.map(b => {
        if (b.id === blockId && b.type === 'video') {
          return { 
            ...b, 
            attributes, 
            prompt: prompt || b.prompt
          };
        }
        return b;
      }),
      updatedAt: Date.now()
    };
    await dbSaveProject(updatedProject);
    return updatedProject;
  }
);

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
    const updateProjectInState = (state: ProjectState, project: Project) => {
      const index = state.items.findIndex(p => p.id === project.id);
      if (index >= 0) state.items[index] = project;
      if (state.currentProject?.id === project.id) state.currentProject = project;
    };

    builder
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.items = action.payload.sort((a, b) => b.updatedAt - a.updatedAt);
        state.status = 'succeeded';
      })
      .addCase(createOrUpdateProject.fulfilled, (state, action) => {
        const index = state.items.findIndex(p => p.id === action.payload.id);
        if (index >= 0) state.items[index] = action.payload;
        else state.items.unshift(action.payload);
        state.items.sort((a, b) => b.updatedAt - a.updatedAt);
        if (state.currentProject?.id === action.payload.id) state.currentProject = action.payload;
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.items = state.items.filter(p => p.id !== action.payload);
        if (state.currentProject?.id === action.payload) state.currentProject = null;
      })
      .addCase(addStoryBlock.fulfilled, (state, action) => updateProjectInState(state, action.payload))
      .addCase(removeStoryBlock.fulfilled, (state, action) => updateProjectInState(state, action.payload))
      .addCase(updateBlockPrompt.fulfilled, (state, action) => updateProjectInState(state, action.payload))
      .addCase(updateBlockAttributes.fulfilled, (state, action) => updateProjectInState(state, action.payload))
      .addCase(updateProjectAsset.fulfilled, (state, action) => updateProjectInState(state, action.payload));
  },
});

export const { setCurrentProject, addProjectTemporary } = projectSlice.actions;
export default projectSlice.reducer;
