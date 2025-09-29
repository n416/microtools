import { createTheme } from '@mui/material/styles';

// アプリ全体のデザインテーマを定義
export const theme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#f4f6f8', // 全体の背景色
      paper: '#ffffff',   // Paperコンポーネントの背景色
    },
    primary: {
      main: '#1976d2', // メインカラー（ボタンなど）
    },
    secondary: {
      main: '#dc004e', // アクセントカラー
    },
  },
  shape: {
    borderRadius: 8, // コンポーネントの角の丸み
  },
  typography: {
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    h5: {
      fontWeight: 600,
    },
  },
});