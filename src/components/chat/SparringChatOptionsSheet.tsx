import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Switch, BackHandler, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  title:        string;
  bottomInset:  number;
  hasAddress:   boolean;
  /** Organizer: media switch + "Sparring absagen". */
  isOrganizer:  boolean;
  /** Signed-up participant of a still running sparring: "Teilnahme absagen". */
  canCancel:    boolean;
  isReadOnly:   boolean;
  mediaEnabled: boolean;
  onToggleMedia: () => void;
  onDetails:    () => void;
  onOpenMaps:   () => void;
  /** Opens the sparring details, where the existing confirmation runs. */
  onCancel:     () => void;
  onClose:      () => void;
}

function Row({ icon, label, hint, danger, onPress }: {
  icon: IconName; label: string; hint?: string; danger?: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6} accessibilityRole="button">
      <Ionicons name={icon} size={22} color={danger === true ? colors.deleteRed : colors.text} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger === true && styles.rowLabelDanger]}>{label}</Text>
        {hint !== undefined && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

// Options of the sparring chat. Rendered as an overlay at the root of the
// screen (no second Modal). The cancel entry is deliberately quiet and leads
// to the details, which own the confirmation and the deadline rules.
export default function SparringChatOptionsSheet({
  title, bottomInset, hasAddress, isOrganizer, canCancel, isReadOnly, mediaEnabled,
  onToggleMedia, onDetails, onOpenMaps, onCancel, onClose,
}: Props) {
  const { t } = useTranslation();

  // Android hardware back closes the sheet instead of leaving the chat.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const showCancel = !isReadOnly && (isOrganizer || canCancel);

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      />
      <View style={[styles.sheet, { paddingBottom: bottomInset + 16 }]}>
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>

        <Row icon="information-circle-outline" label={t('chat.sparring.details')} onPress={onDetails} />
        {hasAddress && <Row icon="map-outline" label={t('chat.sparring.openMaps')} onPress={onOpenMaps} />}

        {isOrganizer && (
          <View style={styles.row}>
            <Ionicons name="image-outline" size={22} color={colors.text} />
            <Text style={[styles.rowLabel, styles.rowText]}>{t('chat.screen.allowMedia')}</Text>
            <Switch
              value={mediaEnabled}
              onValueChange={onToggleMedia}
              trackColor={{ false: colors.hairline, true: colors.accentBlue }}
              thumbColor={colors.card}
            />
          </View>
        )}

        {showCancel && (
          <>
            <View style={styles.divider} />
            <Row
              icon="close-circle-outline"
              label={isOrganizer ? t('chat.sparring.cancelSparring') : t('chat.sparring.cancelParticipation')}
              hint={t('chat.sparring.confirmInDetails')}
              danger
              onPress={onCancel}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.mapOverlay,
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor:      colors.background,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    16,
    paddingTop:           8,
    overflow:             'hidden',
  },
  handleRow: {
    alignItems:    'center',
    paddingBottom: 16,
  },
  handle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.fieldBorder,
  },
  title: {
    fontSize:          18,
    fontWeight:        '700',
    color:             colors.text,
    paddingHorizontal: 8,
    marginBottom:      8,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    minHeight:         56,
    paddingHorizontal: 8,
    gap:               16,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize:   16,
    fontWeight: '500',
    color:      colors.text,
  },
  rowLabelDanger: {
    color: colors.deleteRed,
  },
  rowHint: {
    fontSize:  13,
    color:     colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height:           StyleSheet.hairlineWidth,
    backgroundColor:  colors.fieldBorder,
    marginVertical:   8,
    marginHorizontal: 8,
  },
});
