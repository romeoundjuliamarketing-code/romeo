import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import SheetShell from '../../common/SheetShell';
import ReachIntroContent from './ReachIntroContent';

// Intro / "So funktioniert's" in its own bottom sheet. Only use when no other
// modal is open; inside an open modal use TrustOverlay instead.
export default function ReachIntroSheet({ visible, mode, onPrimary, onSecondary, onClose, busy = false, error = null }: {
  visible: boolean;
  mode: 'intro' | 'explain';
  onPrimary: () => void;
  onSecondary?: () => void;
  onClose: () => void;
  busy?: boolean;
  error?: string | null;
}): React.ReactElement {
  return (
    <SheetShell visible={visible} title="" onClose={onClose} busy={busy}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <ReachIntroContent mode={mode} onPrimary={onPrimary} onSecondary={onSecondary} busy={busy} error={error} />
      </ScrollView>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
});
