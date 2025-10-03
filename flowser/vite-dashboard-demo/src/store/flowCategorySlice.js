import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialCategories = [
  { id: 'cat-uncategorized', name: '未分類' },
  { id: 'cat-sales', name: '営業プロセス' },
  { id: 'cat-support', name: '顧客サポート' },
];

const loadState = () => {
  try {
    // ▼▼▼ 【修正】古いキー(workflowCategories)からもカテゴリリストを読み込むように修正 ▼▼▼
    const serializedCategories = localStorage.getItem('flowCategories') || localStorage.getItem('workflowCategories');
    const serializedSelectedId = localStorage.getItem('selectedFlowCategoryId') || localStorage.getItem('selectedWorkflowCategoryId');
    
    const categories = serializedCategories ? JSON.parse(serializedCategories) : initialCategories;

    // ▼▼▼ 【修正】デフォルトで選択されるカテゴリIDを、保存されたものか、リストの先頭にするように修正 ▼▼▼
    const defaultCategoryId = categories.length > 0 ? categories[0].id : null;
    const selectedCategoryId = serializedSelectedId ? JSON.parse(serializedSelectedId) : defaultCategoryId;

    if (!categories.some(c => c.id === 'cat-uncategorized')) {
      categories.unshift({ id: 'cat-uncategorized', name: '未分類' });
    }

    return { categories, selectedCategoryId };
  } catch (err) {
    return {
      categories: initialCategories,
      selectedCategoryId: initialCategories.length > 0 ? initialCategories[0].id : null,
    };
  }
};

const flowCategorySlice = createSlice({
  name: 'flowCategory',
  initialState: loadState(),
  reducers: {
    addCategory: (state, action) => {
      state.categories.push({ id: `cat-${nanoid()}`, name: action.payload.name });
    },
    updateCategory: (state, action) => {
      const category = state.categories.find(c => c.id === action.payload.id);
      if (category) {
        category.name = action.payload.name;
      }
    },
    deleteCategory: (state, action) => {
      if (action.payload === 'cat-uncategorized') {
        alert('「未分類」カテゴリは削除できません。');
        return;
      }
      state.categories = state.categories.filter(c => c.id !== action.payload);
      if (state.selectedCategoryId === action.payload) {
        state.selectedCategoryId = state.categories.length > 0 ? state.categories[0].id : null;
      }
    },
    selectCategoryId: (state, action) => {
      state.selectedCategoryId = action.payload;
    },
  },
});

export const { addCategory, updateCategory, deleteCategory, selectCategoryId } = flowCategorySlice.actions;

export default flowCategorySlice.reducer;