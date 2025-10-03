import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialCategories = [
  { id: 'cat-uncategorized', name: '未分類' },
  { id: 'cat-sales', name: '営業プロセス' },
  { id: 'cat-support', name: '顧客サポート' },
];

const loadState = () => {
  try {
    const serializedCategories = localStorage.getItem('workflowCategories');
    const serializedSelectedId = localStorage.getItem('selectedWorkflowCategoryId');
    
    const categories = serializedCategories ? JSON.parse(serializedCategories) : initialCategories;
    const selectedCategoryId = serializedSelectedId ? JSON.parse(serializedSelectedId) : 'cat-uncategorized';

    // 初期データに「未分類」がなければ追加する
    if (!categories.some(c => c.id === 'cat-uncategorized')) {
      categories.unshift({ id: 'cat-uncategorized', name: '未分類' });
    }

    return { categories, selectedCategoryId };
  } catch (err) {
    return {
      categories: initialCategories,
      selectedCategoryId: 'cat-uncategorized',
    };
  }
};

const workflowCategorySlice = createSlice({
  name: 'workflowCategory',
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
      // 「未分類」カテゴリは削除不可
      if (action.payload === 'cat-uncategorized') {
        alert('「未分類」カテゴリは削除できません。');
        return;
      }
      state.categories = state.categories.filter(c => c.id !== action.payload);
      // 削除したカテゴリが選択されていたら、「未分類」を選択状態にする
      if (state.selectedCategoryId === action.payload) {
        state.selectedCategoryId = 'cat-uncategorized';
      }
    },
    selectCategoryId: (state, action) => {
      state.selectedCategoryId = action.payload;
    },
  },
});

export const { addCategory, updateCategory, deleteCategory, selectCategoryId } = workflowCategorySlice.actions;

export default workflowCategorySlice.reducer;