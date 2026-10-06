import React from 'react';
import { StatusBar } from 'expo-status-bar';
import type { StatusBarStyle } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';

// Status bar style for screens with a dark or light hero. Only applied while
// the screen is focused: tab screens stay mounted in the background and would
// otherwise override the style of the visible screen. On blur the previous
// style (App.tsx default) is restored automatically.
export default function FocusedStatusBar({ style }: { style: StatusBarStyle }): React.ReactElement | null {
  const isFocused = useIsFocused();
  return isFocused ? <StatusBar style={style} /> : null;
}
