import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useEventCreatePurchase } from '../../hooks/useEventCreatePurchase';
import { useTranslation } from 'react-i18next';

interface Props {
  eventId:     string;
  visible:     boolean;
  onClose:     () => void;
  onActivated: () => void;
}

export default function EventPaymentSheet({
  eventId,
  visible,
  onClose,
  onActivated,
}: Props): React.ReactElement | null {
  const { t } = useTranslation();
  const {
    purchase,
    loadPackage,
    eventPackage,
    purchasing,
    activating,
    packageLoading,
  } = useEventCreatePurchase();

  useEffect(() => {
    void loadPackage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Poll-based activation is handled inside useEventCreatePurchase.
  // We call onActivated after purchase completes without the activating state.
  useEffect(() => {
    if (!purchasing && !activating && eventPackage !== null) {
      // Activating transition: notify parent once activating ends (purchase done).
    }
  }, [purchasing, activating, eventPackage]);

  if (!visible) return null;

  const priceLabel = eventPackage?.product.priceString ?? t('sparring.eventPayment.priceFallback');
  const isLoading  = packageLoading;
  const isBusy     = purchasing || activating;

  function handlePurchase(): void {
    void (async () => {
      await purchase(eventId);
      // After polling inside purchase(), notify the parent that the event is active.
      onActivated();
    })();
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>

        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.iconRow}>
          <View style={styles.iconWrapper}>
            <MaterialCommunityIcons name="television-play" size={32} color={colors.accentBlue} />
          </View>
        </View>

        <Text style={styles.title}>{t('sparring.eventPayment.title')}</Text>
        <Text style={styles.subtitle}>
          {t('sparring.eventPayment.subtitle')}
        </Text>

        {isLoading && (
          <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
        )}

        {!isLoading && !isBusy && (
          <View style={styles.priceRow}>
            <Text style={styles.price}>{priceLabel}</Text>
            <Text style={styles.pricePeriod}>{t('sparring.eventPayment.oneTime')}</Text>
          </View>
        )}

        {activating && (
          <View style={styles.activatingRow}>
            <ActivityIndicator size="small" color={colors.accentBlue} />
            <Text style={styles.activatingText}>{t('sparring.eventPayment.activating')}</Text>
          </View>
        )}

        {!isLoading && (
          <TouchableOpacity
            style={[styles.btn, isBusy && styles.btnDisabled]}
            onPress={handlePurchase}
            disabled={isBusy}
            activeOpacity={0.85}
          >
            {isBusy ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.btnText}>{t('sparring.eventPayment.buy')}</Text>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.legal}>
          {t('sparring.eventPayment.legal')}
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor:      colors.card,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    24,
    paddingBottom:        48,
    gap:                  16,
  },
  handleRow: {
    alignItems:    'center',
    paddingTop:    12,
    paddingBottom: 0,
  },
  handle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.border,
  },
  closeBtn: {
    position:       'absolute',
    top:            16,
    right:          16,
    width:          36,
    height:         36,
    alignItems:     'center',
    justifyContent: 'center',
  },
  iconRow: {
    alignItems:    'center',
    paddingTop:    8,
    paddingBottom: 0,
  },
  iconWrapper: {
    width:           64,
    height:          64,
    borderRadius:    32,
    backgroundColor: colors.accentBlueSoft,
    alignItems:      'center',
    justifyContent:  'center',
  },
  title: {
    fontSize:   22,
    fontWeight: '700',
    color:      colors.text,
    textAlign:  'center',
  },
  subtitle: {
    fontSize:   14,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 20,
  },
  loader: {
    marginVertical: 16,
  },
  priceRow: {
    alignItems: 'center',
    gap:        4,
  },
  price: {
    fontSize:   32,
    fontWeight: '800',
    color:      colors.text,
  },
  pricePeriod: {
    fontSize: 13,
    color:    colors.textSecondary,
  },
  activatingRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
  },
  activatingText: {
    fontSize: 14,
    color:    colors.textSecondary,
  },
  btn: {
    backgroundColor: colors.accentBlue,
    borderRadius:    14,
    height:          50,
    alignItems:      'center',
    justifyContent:  'center',
  },
  btnDisabled: {
    backgroundColor: colors.accentBlueMuted,
  },
  btnText: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.card,
  },
  legal: {
    fontSize:   12,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: 18,
  },
});
