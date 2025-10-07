import React from 'react';
import { GlobalStyles, useTheme } from '@mui/material';

export const ThemeOverrides = () => {
  const theme = useTheme();

  const styles = {
    // --- Calendar Styles ---
    '.react-calendar': {
      border: 'none',
      backgroundColor: theme.palette.background.paper,
    },
    // 前回の 'react-calendar__month-view__days > button' のスタイル指定は削除

    '.react-calendar__tile--now': {
      background: 'transparent !important',
      color: `${theme.palette.text.primary} !important`,
    },
    '.react-calendar__navigation button': {
      color: theme.palette.text.primary,
      backgroundColor: 'transparent',
      '&:hover, &:focus': {
        backgroundColor: theme.palette.action.hover,
      },
    },
    '.react-calendar__month-view__weekdays__weekday abbr': {
      color: theme.palette.text.secondary,
      textDecoration: 'none',
    },
    // --- ★★★ ここから修正 ★★★ ---
    '.react-calendar__tile': {
      color: theme.palette.text.primary,
      backgroundColor: 'transparent',
      borderRadius: '4px',
      border: 'none', // borderをリセット
      // 内側に背景色と同じ色の影を作り、隙間に見せる
      boxShadow: `inset 0 0 0 2px ${theme.palette.background.paper}`,
      '&:hover, &:focus': {
        backgroundColor: theme.palette.action.hover,
      },
    },
    // --- ★★★ ここまで修正 ★★★ ---
    '.react-calendar__tile--active': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      '&:hover, &:focus': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
    '.react-calendar__month-view__days__day--neighboringMonth': {
      color: theme.palette.text.disabled,
    },

    // --- Clock Styles ---
    '.react-clock__face': {
      borderColor: theme.palette.text.secondary,
      backgroundColor: theme.palette.background.paper,
    },
    '.react-clock__mark__body, .react-clock__mark__body--hour': {
      backgroundColor: theme.palette.text.secondary,
    },
    '.react-clock__number': {
      color: theme.palette.text.primary,
      fontSize: '14px',
      fontWeight: 'bold',
    },
    '.react-clock__hand__body': {
      backgroundColor: theme.palette.text.primary,
    },
    '.react-clock__second-hand__body': {
      backgroundColor: theme.palette.error.main,
    },
  };

  return <GlobalStyles styles={styles} />;
};