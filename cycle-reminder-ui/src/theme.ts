import { createTheme } from '@mui/material/styles';

// ライトモード用のテーマ
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#333', // プライマリーカラーを濃いグレーに
    },
    secondary: {
      main: '#777', // セカンダリーカラーをグレーに
    },
    background: {
      default: '#f4f4f4', // 背景色
    }
  },
});

// ダークモード用のテーマ
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#f0f0f0', // プライマリーカラーを明るいグレーに
    },
    secondary: {
      main: '#aaa', // セカンダリーカラーをミディアムグレーに
    },
    background: {
      default: '#121212', // 背景色
      paper: '#1e1e1e', // Cardなどの背景色
    },
  },
});