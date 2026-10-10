import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import CoachInviteOverlay from '../coach/CoachInviteOverlay';
import { COACH_CARDS } from '../coach/coachFigures';
import { useTabBarOverlap } from '../navigation/SparrTabBar';
import { useMountedOnce } from '../common/SheetShell';

// Coach invite before the paywall when the card game is still locked.
export default function CardGameInvite({ visible, onUnlock, onClose }: {
  visible:  boolean;
  onUnlock: () => void;
  onClose:  () => void;
}): React.ReactElement | null {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, useTabBarOverlap());
  const mounted = useMountedOnce(visible);
  if (!mounted) return null;
  return (
    <CoachInviteOverlay
      visible={visible}
      figure={COACH_CARDS}
      bottomInset={bottomInset}
      lead={t('challenge.invite.lead')}
      body={t('challenge.invite.body')}
      primaryLabel={t('challenge.invite.primary')}
      laterLabel={t('challenge.invite.later')}
      onPrimary={onUnlock}
      onClose={onClose}
    />
  );
}
