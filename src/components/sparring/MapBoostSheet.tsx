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
import { useMapBoostPurchase } from '../../hooks/useMapBoostPurchase';

interface Props {
  sparringId:       string;
  visible:          boolean;
  onClose:          () => void;
  onBoostActivated: () => void;
}

export default function MapBoostSheet({
  sparringId,
  visible,
  onClose,
  onBoostActivated,
}: Props): React.ReactElement | null {
  if (!visible) return null;

  const {
    purchase,
    loadStatus,
    loadPackage,
    boostStatus,
    boostPackage,
    purchasing,
    activating,
    statusLoading,
    packageLoading,
  } = useMapBoostPurchase();

  useEffect(() => {
    void loadPackage();
    void loadStatus(sparringId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sparringId]);

  // Notify parent after boost is confirmed active.
  useEffect(() => {
    if (boostStatus.isActive) {
      onBoostActivated();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boostStatus.isActive]);

  const priceLabel = boostPackage?.product.priceString ?? '€12,99';
  const isLoading  = statusLoading || packageLoading;
  const isBusy     = purchasing || activating;

  function handlePurchase(): void {
    void purchase(sparringId);
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
            <MaterialCommunityIcons name="star-circle" size={32} color={colors.accentBlue} />
          </View>
        </View>

        <Text style={styles.title}>Karten-Boost</Text>
        <Text style={styles.subtitle}>
          Dein Sparring erscheint 30 Tage lang als hervorgehobener Marker auf der Karte.
        </Text>

        {isLoading && (
          <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
        )}

        {!isLoading && boostStatus.isActive && (
          <View style={styles.activeCard}>
            <MaterialCommunityIcons name="check-circle" size={20} color={colors.difficultyGreen} />
            <View style={styles.activeCardText}>
              <Text style={styles.activeLabel}>Boost aktiv</Text>
              <Text style={styles.activeSub}>
                {boostStatus.daysRemaining !== null
                  ? `Noch ${boostStatus.daysRemaining} ${boostStatus.daysRemaining === 1 ? 'Tag' : 'Tage'}`
                  : 'Läuft demnächst ab'}
              </Text>
            </View>
          </View>
        )}

        {!isLoading && !boostStatus.isActive && !isBusy && (
          <View style={styles.priceRow}>
            <Text style={styles.price}>{priceLabel}</Text>
            <Text style={styles.pricePeriod}>einmalig · 30 Tage</Text>
          </View>
        )}

        {activating && (
          <View style={styles.activatingRow}>
            <ActivityIndicator size="small" color={colors.accentBlue} />
            <Text style={styles.activatingText}>Boost wird aktiviert…</Text>
          </View>
        )}

        {!isLoading && !boostStatus.isActive && (
          <TouchableOpacity
            style={[styles.btn, isBusy && styles.btnDisabled]}
            onPress={handlePurchase}
            disabled={isBusy}
            activeOpacity={0.85}
          >
            {isBusy ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.btnText}>Karten-Boost aktivieren</Text>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.legal}>
          Einmaliger Kauf. Kein automatisches Abo. Abrechnung über den App Store.
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
    alignItems:   'center',
    paddingTop:   12,
    paddingBottom: 0,
  },
  handle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.border,
  },
  closeBtn: {
    position: 'absolute',
    top:      16,
    right:    16,
    width:    36,
    height:   36,
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
  activeCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    backgroundColor: 'rgba(82,196,26,0.1)',
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     colors.difficultyGreen,
    padding:         16,
  },
  activeCardText: {
    gap: 2,
  },
  activeLabel: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.difficultyGreen,
  },
  activeSub: {
    fontSize: 13,
    color:    colors.textSecondary,
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
    fontSize:  12,
    color:     colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
