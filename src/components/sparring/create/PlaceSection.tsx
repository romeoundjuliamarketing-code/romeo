import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { GYM_LIMITS } from '../../../utils/gymSearch';
import { gymHasAddress, type DraftGym, type PlaceSource } from '../../../utils/sparringDraft';
import { TextAction } from '../../common/TextAction';
import { FieldError } from './FlowParts';

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
            <Text style={styles.changeText}>Ändern</Text>
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
  if (fromMap) {
    return (
      <PlaceSummary
        icon="location" label="Treffpunkt" name={address} address={null}
        onChange={onOpenMap} changeLabel="Treffpunkt auf der Karte ändern"
        onRemove={onClear} removeLabel="Treffpunkt entfernen"
      />
    );
  }
  return (
    <View style={styles.addressRow}>
      <TextInput
        style={[styles.field, styles.addressInput]}
        value={address}
        onChangeText={onAddress}
        placeholder="Straße, Hausnummer, Ort"
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        blurOnSubmit
        autoCorrect={false}
        textContentType="fullStreetAddress"
        accessibilityLabel="Adresse des Treffpunkts"
      />
      <TouchableOpacity style={styles.mapBtn} onPress={onOpenMap} accessibilityRole="button" accessibilityLabel="Treffpunkt auf der Karte wählen">
        <Ionicons name="map-outline" size={20} color={colors.accentBlueText} />
        <Text style={styles.mapBtnText}>Karte</Text>
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
  const [noteOpen, setNoteOpen] = useState(accessNote.length > 0);

  if (source === null) {
    return (
      <View>
        <View style={styles.choices}>
          <ChoiceTile icon="business-outline" label="Gym wählen" hint="Ort ist ein Gym" onPress={actions.onPickGym} />
          <ChoiceTile icon="search-outline" label="Adresse suchen" hint="Eigener Treffpunkt" onPress={actions.onSearchAddress} />
        </View>
        {studioAddress !== null && (
          <TextAction label="Am Studio-Standort" icon="home-outline" onPress={actions.onUseStudio} />
        )}
        <FieldError text={error} />
      </View>
    );
  }

  if (source === 'studio') {
    return (
      <View>
        <PlaceSummary
          icon="home" label="Studio-Standort" name="Dein Studio" address={address}
          changeLabel="" onRemove={actions.onClearPlace} removeLabel="Ort entfernen"
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
          icon="business" label="Gym" name={gym.name}
          address={source === 'gym' ? address : gym.city}
          onChange={actions.onPickGym} changeLabel="Anderes Gym wählen"
          onRemove={actions.onClearPlace} removeLabel="Gym entfernen"
        />
      )}

      {gymAddressMissing && (
        <Text style={styles.note}>
          Für dieses Gym ist keine Adresse hinterlegt. Gib an, wo ihr euch trefft.
        </Text>
      )}

      {source === 'custom' && (
        <View style={gym !== null ? styles.meetingBlock : undefined}>
          {meetingDiffers && <Text style={styles.meetingLabel}>Treffpunkt</Text>}
          <AddressField
            address={address}
            fromMap={hasCoord && address.trim().length > 0}
            onAddress={actions.onAddress}
            onOpenMap={actions.onOpenMap}
            onClear={actions.onClearAddress}
          />
          {gym === null && (
            <TextAction label="Stattdessen Gym wählen" icon="business-outline" onPress={actions.onPickGym} />
          )}
          {meetingDiffers && !gymAddressMissing && (
            <TextAction label="Gym-Adresse als Treffpunkt" icon="arrow-undo-outline" onPress={actions.onUseGymAddress} />
          )}
        </View>
      )}

      <FieldError text={error} />

      {source === 'gym' && (
        <TextAction label="Treffpunkt weicht vom Gym ab" icon="navigate-outline" onPress={actions.onCustomMeeting} />
      )}

      {gym !== null && (
        noteOpen ? (
          <View style={styles.meetingBlock}>
            <Text style={styles.meetingLabel}>Zugang zum Gym</Text>
            <TextInput
              style={styles.field}
              value={accessNote}
              onChangeText={actions.onAccessNote}
              placeholder="Zum Beispiel Gäste nach Absprache"
              placeholderTextColor={colors.textMuted}
              maxLength={GYM_LIMITS.accessNote}
              returnKeyType="done"
              blurOnSubmit
              accessibilityLabel="Zugangshinweis"
            />
            <Text style={styles.note}>Das Sparring bleibt dein Treffen, das Gym ist nur der Ort. Kläre den Zugang vorher mit dem Gym.</Text>
          </View>
        ) : (
          <TextAction label="Zugangshinweis ergänzen" icon="add" onPress={() => setNoteOpen(true)} />
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
