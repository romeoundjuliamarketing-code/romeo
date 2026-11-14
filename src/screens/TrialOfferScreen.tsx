import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useStoreEntitlements } from '../hooks/useStoreEntitlements';
import { loadPremiumOffer, PremiumOffer, PREVIEW_TRIAL, PREVIEW_TRIAL_OFFER, purchasePremium } from '../lib/premiumOffer';
import { durationText, paywallCta } from '../utils/paywallTrial';
import TrialOfferSheet from '../components/paywall/TrialOfferSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'TrialOffer'>;

// Transparent modal route (not an RN <Modal>): it may open while a sheet is
// up on the map, and two sibling modals would block all touches on iOS.
// Android back closes it via the stack.
export default function TrialOfferScreen({ navigation }: Props): React.ReactElement {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { refetch } = useStoreEntitlements();
  const [offer, setOffer] = useState<PremiumOffer | null | undefined>(undefined);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (PREVIEW_TRIAL_OFFER) return;
    let active = true;
    loadPremiumOffer()
      .catch(() => null)
      .then((result) => {
        if (!active) return;
        // No trial any more (e.g. used in the meantime): nothing to offer.
        if (result === null || result.trial === null) navigation.goBack();
        else setOffer(result);
      });
    return () => { active = false; };
  }, [navigation]);

  function close(): void {
    if (!purchasing) navigation.goBack();
  }

  async function start(): Promise<void> {
    if (offer === undefined || offer === null || user === null) return;
    setPurchasing(true);
    try {
      await purchasePremium(offer.pkg, user.id);
      await refetch();
      navigation.goBack();
    } catch (err: unknown) {
      const isCancelled =
        typeof err === 'object' && err !== null && 'userCancelled' in err &&
        (err as { userCancelled: boolean }).userCancelled;
      if (!isCancelled) {
        Alert.alert(t('paywall.purchaseFailed'), err instanceof Error ? err.message : t('paywall.tryAgain'));
      }
    } finally {
      setPurchasing(false);
    }
  }

  const trial = PREVIEW_TRIAL_OFFER ? PREVIEW_TRIAL : offer?.trial ?? null;
  const duration = trial !== null ? durationText(trial) : null;
  const note = trial !== null
    ? paywallCta({ premiumActive: false, price: trial.priceAfter, trial }).note
    : null;

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t('common.close')} />
      <ScrollView contentContainerStyle={styles.center} bounces={false} showsVerticalScrollIndicator={false}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessible={false} />
      <TrialOfferSheet
        duration={duration}
        note={note}
        enabled={trial !== null}
        loading={purchasing}
        onStart={PREVIEW_TRIAL_OFFER ? close : () => { void start(); }}
        onLater={close}
      />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.sheetScrim,
  },
  // Centered voucher; scrolls on small screens instead of being cut off.
  center: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
});
