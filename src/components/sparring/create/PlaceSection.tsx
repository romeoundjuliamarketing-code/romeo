import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { GYM_LIMITS } from '../../../utils/gymSearch';
import { gymHasAddress, type DraftGym, type PlaceSource } from '../../../utils/sparringDraft';
import { TextAction } from '../../common/TextAction';
import { FieldError } from './FlowParts';
import { useTranslation } from 'react-i18next';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export interface PlaceActions {
  onPickGym:           () => void;
  onSearchAddress:     () => void;
  onOpenMap:           () => void;
  onAddress:           (text: string) => void;
  onClearAddress:      () => void;
  onClearPlace:        () => void;
  onUseStudio:         () => void;
  onUseGymAddress:     () => void;
  onCustomMeeting:     () => void;
  onAccessNote:        (text: string) => void;
}

// Compact place view: icon, label, name, address, "Ändern" (and remove).
function PlaceSummary({ icon, label, name, address, onChange, changeLabel, onRemove, removeLabel }: {
  icon:        IoniconsName;
  label:       string;
  name:        string;
  address:     string | null;
  onChange?:   () => void;
  changeLabel: string;
  onRemove:    () => void;
  removeLabel: string;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.summary}>
      <View style={styles.summaryIcon}>
        <Ionicons name={icon} size={20} color={colors.headerTextPrimary} />
      </View>
      <View style={styles.summaryText}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryName}>{name}</Text>
        {address !== null && <Text style={styles.summaryAddress}>{address}</Text>}
      </View>
      <View style={styles.summaryActions}>
        {onChange !== undefined && (
          <TouchableOpacity onPress={onChange} style={styles.summaryBtn} accessibilityRole="button" accessibilityLabel={changeLabel}>
            <Text style={styles.changeText}>{t('map.search.change')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onRemove} style={styles.summaryBtn} accessibilityRole="button" accessibilityLabel={removeLabel}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ChoiceTile({ icon, label, hint, onPress }: {
  icon: IoniconsName; label: string; hint: string; onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={hint}
    >
      <Ionicons name={icon} size={24} color={colors.accentBlueText} />
      <Text style={styles.choiceLabel}>{label}</Text>
      <Text style={styles.choiceHint}>{hint}</Text>
    </Pressable>
  );
}

// The meeting point as free address: typed (geocoded on save) or from the map.
function AddressField({ address, fromMap, onAddress, onOpenMap, onClear }: {
  address: string; fromMap: boolean;
  onAddress: (t: string) => void; onOpenMap: () => void; onClear: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  if (fromMap) {
    return (
      <PlaceSummary
        icon="location" label={t('sparring.place.meetingPoint')} name={address} address={null}
        onChange={onOpenMap} changeLabel={t('sparring.place.changeOnMap')}
        onRemove={onClear} removeLabel={t('sparring.place.removeMeeting')}
      />
    );
  }
  return (
    <View style={styles.addressRow}>
      <TextInput
        style={[styles.field, styles.addressInput]}
        value={address}
        onChangeText={onAddress}
        placeholder={t('sparring.place.addressPlaceholder')}
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        blurOnSubmit
        autoCorrect={false}
        textContentType="fullStreetAddress"
        accessibilityLabel={t('sparring.place.addressA11y')}
      />
      <TouchableOpacity style={styles.mapBtn} onPress={onOpenMap} accessibilityRole="button" accessibilityLabel={t('sparring.place.pickOnMap')}>
        <Ionicons name="map-outline" size={20} color={colors.accentBlueText} />
        <Text style={styles.mapBtnText}>{t('map.search.viewMap')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function PlaceSection({ gym, source, address, hasCoord, accessNote, studioAddress, error, actions }: {
  gym:           DraftGym | null;
  source:        PlaceSource | null;
  address:       string;
  hasCoord:      boolean;
  accessNote:    string;
  /** Team studio address when the user may meet at the studio. */
  studioAddress: string | null;
  error:         string | undefined;
  actions:       PlaceActions;
}): React.ReactElement {
  const { t } = useTranslation();
  const [noteOpen, setNoteOpen] = useState(accessNote.length > 0);

  if (source === null) {
    return (
      <View>
        <View style={styles.choices}>
          <ChoiceTile icon="business-outline" label={t('sparring.place.pickGym')} hint={t('sparring.place.pickGymHint')} onPress={actions.onPickGym} />
          <ChoiceTile icon="search-outline" label={t('sparring.place.searchAddress')} hint={t('sparring.place.searchAddressHint')} onPress={actions.onSearchAddress} />
        </View>
        {studioAddress !== null && (
          <TextAction label={t('sparring.place.atStudio')} icon="home-outline" onPress={actions.onUseStudio} />
        )}
        <FieldError text={error} />
      </View>
    );
  }

  if (source === 'studio') {
    return (
      <View>
        <PlaceSummary
          icon="home" label={t('sparring.place.studioLocation')} name={t('sparring.preview.yourGym')} address={address}
          changeLabel="" onRemove={actions.onClearPlace} removeLabel={t('sparring.place.removePlace')}
        />
        <FieldError text={error} />
      </View>
    );
  }

  const meetingDiffers = gym !== null && source === 'custom';
  const gymAddressMissing = gym !== null && !gymHasAddress(gym);

  return (
    <View>
      {gym !== null && (
        <PlaceSummary
          icon="business" label={t('sparring.place.gym')} name={gym.name}
          address={source === 'gym' ? address : gym.city}
          onChange={actions.onPickGym} changeLabel={t('sparring.place.otherGym')}
          onRemove={actions.onClearPlace} removeLabel={t('sparring.place.removeGym')}
        />
      )}

      {gymAddressMissing && (
        <Text style={styles.note}>
          {t('sparring.place.gymNoAddress')}
        </Text>
      )}

      {source === 'custom' && (
        <View style={gym !== null ? styles.meetingBlock : undefined}>
          {meetingDiffers && <Text style={styles.meetingLabel}>{t('sparring.place.meetingPoint')}</Text>}
          <AddressField
            address={address}
            fromMap={hasCoord && address.trim().length > 0}
            onAddress={actions.onAddress}
            onOpenMap={actions.onOpenMap}
            onClear={actions.onClearAddress}
          />
          {gym === null && (
            <TextAction label={t('sparring.place.pickGymInstead')} icon="business-outline" onPress={actions.onPickGym} />
          )}
          {meetingDiffers && !gymAddressMissing && (
            <TextAction label={t('sparring.place.useGymAddress')} icon="arrow-undo-outline" onPress={actions.onUseGymAddress} />
          )}
        </View>
      )}

      <FieldError text={error} />

      {source === 'gym' && (
        <TextAction label={t('sparring.place.customMeeting')} icon="navigate-outline" onPress={actions.onCustomMeeting} />
      )}

      {gym !== null && (
        noteOpen ? (
          <View style={styles.meetingBlock}>
            <Text style={styles.meetingLabel}>{t('sparring.place.gymAccess')}</Text>
            <TextInput
              style={styles.field}
              value={accessNote}
              onChangeText={actions.onAccessNote}
              placeholder={t('sparring.place.accessPlaceholder')}
              placeholderTextColor={colors.textMuted}
              maxLength={GYM_LIMITS.accessNote}
              returnKeyType="done"
              blurOnSubmit
              accessibilityLabel={t('sparring.place.accessA11y')}
            />
            <Text style={styles.note}>{t('sparring.place.accessNote')}</Text>
          </View>
        ) : (
          <TextAction label={t('sparring.place.addAccess')} icon="add" onPress={() => setNoteOpen(true)} />
        )
      )}
    </View>
  );
}

export default React.memo(PlaceSection);

const styles = StyleSheet.create({
  choices: {
    flexDirection: 'row',
    gap: 8,
  },
  choice: {
    flex: 1,
    minHeight: 112,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    gap: 8,
  },
  choicePressed: {
    backgroundColor: colors.hairline,
  },
  choiceLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  choiceHint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  summaryName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  summaryAddress: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: 8,
  },
  summaryActions: {
    alignItems: 'flex-end',
  },
  summaryBtn: {
    minHeight: 40,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
  meetingBlock: {
    marginTop: 16,
  },
  meetingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addressInput: {
    flex: 1,
  },
  field: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    fontSize: 16,
    color: colors.text,
  },
  mapBtn: {
    minWidth: 72,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  mapBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: 8,
  },
});
