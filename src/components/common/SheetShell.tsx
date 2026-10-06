import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

// Bottom sheet frame: dark overlay behind the whole sheet (clean corners),
// tap outside / close button / Android back, keyboard-aware, header with an
// optional back button. `height` fixes the sheet height (it still shrinks for
// the keyboard); without it the sheet fits its content up to 90 %.
export default function SheetShell({ visible, title, onClose, onBack, busy = false, height, children }: {
  visible:   boolean;
  title:     string;
  onClose:   () => void;
  /** Shows a back button; also what Android back does. */
  onBack?:   () => void;
  busy?:     boolean;
  height?:   number;
  children:  React.ReactNode;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const back = onBack ?? onClose;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={busy ? () => {} : back} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} accessibilityLabel="Schließen" />
        <KeyboardAvoidingView behavior="padding" style={styles.kav} pointerEvents="box-none">
          <View style={[styles.sheet, height !== undefined ? { height } : styles.sheetFit, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.header}>
              {onBack !== undefined ? (
                <TouchableOpacity style={styles.iconBtn} onPress={onBack} disabled={busy} accessibilityRole="button" accessibilityLabel="Zurück">
                  <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
              ) : <View style={styles.iconBtn} />}
              <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{title}</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={onClose} disabled={busy} accessibilityRole="button" accessibilityLabel="Schließen">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {children}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// Mounts a sheet only from its first opening on: hidden sheets that were never
// opened run no hooks (no word-filter fetch, no search state). After that it
// stays mounted, so closing keeps its slide-out animation.
export function useMountedOnce(visible: boolean): boolean {
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);
  return mounted || visible;
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    justifyContent:  'flex-end',
    backgroundColor: colors.mapOverlay,
  },
  kav: {
    flex:           1,
    justifyContent: 'flex-end',
  },
  sheet: {
    flexShrink:           1,
    backgroundColor:      colors.background,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    overflow:             'hidden',
    paddingHorizontal:    16,
    paddingTop:           8,
    gap:                  16,
  },
  sheetFit: {
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  iconBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  title: {
    flex:       1,
    fontSize:   18,
    fontWeight: '800',
    color:      colors.text,
    textAlign:  'center',
  },
});
