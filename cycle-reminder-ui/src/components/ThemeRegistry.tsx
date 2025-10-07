import React, { createContext, useMemo, useContext } from 'react';
import { ThemeProvider, useMediaQuery } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from '@/theme';
import useLocalStorage from '@/hooks/useLocalStorage';
import { ThemeOverrides } from './ThemeOverrides';
import { useAppDispatch } from '@/app/hooks'; // 1. useAppDispatch をインポート
import { showToast } from '@/features/toast/toastSlice'; // 2. showToast をインポート

const ColorModeContext = createContext({
  toggleColorMode: () => {},
  mode: 'auto',
});

export const useColorMode = () => useContext(ColorModeContext);

export const ThemeRegistry = ({ children }: { children: React.ReactNode }) => {
  const [mode, setMode] = useLocalStorage<'auto' | 'light' | 'dark'>('themeMode', 'auto');
  const dispatch = useAppDispatch(); // 3. dispatch関数を取得
  
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
          // --- ★★★ ここからトースト通知処理を追加 ★★★ ---
          const nextMode = prevMode === 'auto' ? 'light' : prevMode === 'light' ? 'dark' : 'auto';
          const modeText = { auto: 'システム設定に連動', light: 'ライトモード', dark: 'ダークモード' };
          dispatch(showToast({ message: `テーマを「${modeText[nextMode]}」に変更しました`, severity: 'info' }));
          return nextMode;
          // --- ★★★ ここまで追加 ★★★ ---
        });
      },
      mode,
    }),
    [setMode, mode, dispatch],
  );

  const theme = useMemo(() => {
    if (mode === 'auto') {
      return prefersDarkMode ? darkTheme : lightTheme;
    }
    return mode === 'light' ? lightTheme : darkTheme;
  }, [mode, prefersDarkMode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ThemeOverrides />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};