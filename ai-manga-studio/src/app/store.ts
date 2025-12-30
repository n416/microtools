import { configureStore } from '@reduxjs/toolkit';
import projectReducer from '../features/projects/projectSlice';
import assetReducer from '../features/assets/assetSlice';

export const store = configureStore({
  reducer: {
    projects: projectReducer,
    assets: assetReducer,
  },
  // Blobsなどのシリアライズできないデータを扱う際の警告を抑制（URL文字列管理にしたので基本大丈夫ですが念のため）
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;