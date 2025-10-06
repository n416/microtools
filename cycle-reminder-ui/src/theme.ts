import { createTheme } from '@mui/material/styles';
import { grey } from '@mui/material/colors';

// アプリ全体のテーマを定義
export const theme = createTheme({
  palette: {
    primary: {
      main: grey[800], // プライマリーカラーを濃いグレーに
    },
    secondary: {
      main: grey[500], // セカンダリーカラーをグレーに
    },
  },
});