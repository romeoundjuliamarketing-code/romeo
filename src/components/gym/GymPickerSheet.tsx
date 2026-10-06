import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Modal,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useGymSearch, findSimilarGyms, createGym } from '../../hooks/useGyms';
import type { Gym } from '../../hooks/useGyms';
import { useBannedWords } from '../../hooks/useBannedWords';
import { checkText, filterErrorMessage } from '../../utils/contentFilter';
import { GYM_LIMITS, isSameGym, validateNewGym } from '../../utils/gymSearch';
import { PrimaryButton } from '../profil/ProfileParts';

type Step = 'search' | 'add' | 'similar';

interface Props {
  visible:      boolean;
  title:        string;
  currentGymId: string | null;
  onClose:      () => void;
  /** Resolves true when the selection was applied (the sheet then closes). */
  onSelect:     (gym: Gym) => Promise<boolean>;
  /** Offered when a gym is set, e.g. "Gym entfernen". */
  removeLabel?: string;
  onRemove?:    () => Promise<boolean>;
}

// Search a shared gym by name or city, pick it, or add a missing one. Adding
// shows similar existing entries first, so the same gym is not created twice;
// the server returns the existing row for an exact name+city match anyway.
export default function GymPickerSheet({
  visible, title, currentGymId, onClose, onSelect, removeLabel, onRemove,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Fixed share of the screen; flexShrink lets the keyboard squeeze it.
  const sheetHeight = Math.round(useWindowDimensions().height * 0.88);
  const { bannedWords } = useBannedWords();
  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState('');
  const { results, status, retry } = useGymSearch(query, visible && step === 'search');

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<{ name?: string; city?: string; address?: string; form?: string }>({});
  const [similar, setSimilar] = useState<Gym[]>([]);
  const [busy, setBusy] = useState(false);

  // Every opening starts with an empty search.
  useEffect(() => {
    if (!visible) return;
    setStep('search');
    setQuery('');
    setErrors({});
    setSimilar([]);
    setBusy(false);
  }, [visible]);

  function back(): void {
    if (busy) return;
    if (step === 'similar') setStep('add');
    else if (step === 'add') setStep('search');
    else onClose();
  }

  async function choose(gym: Gym): Promise<void> {
    if (busy) return;
    setBusy(true);
    const ok = await onSelect(gym);
    setBusy(false);
    if (ok) onClose();
  }

  async function remove(): Promise<void> {
    if (busy || onRemove === undefined) return;
    setBusy(true);
    const ok = await onRemove();
    setBusy(false);
    if (ok) onClose();
  }

  function startAdd(): void {
    // Prefill from the search: "Phoenix Berlin" is a fine start for the name.
    setName(query.trim().slice(0, GYM_LIMITS.name));
    setCity('');
    setAddress('');
    setErrors({});
    setStep('add');
  }

  async function checkAndContinue(): Promise<void> {
    const next: typeof errors = validateNewGym({ name, city, address });
    for (const [field, value] of [['name', name], ['city', city], ['address', address]] as const) {
      if (next[field] !== undefined) continue;
      const verdict = checkText(value, bannedWords);
      if (!verdict.ok) next[field] = filterErrorMessage(verdict.category);
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    const found = await findSimilarGyms(name, city);
    setBusy(false);
    const exact = found.find((g) => isSameGym(g, { name, city }));
    if (exact !== undefined) {
      // Already there — use the shared entry instead of a duplicate.
      await choose(exact);
      return;
    }
    if (found.length > 0) {
      setSimilar(found);
      setStep('similar');
      return;
    }
    await saveNew();
  }

  async function saveNew(): Promise<void> {
    setBusy(true);
    const { gym, error } = await createGym(name, city, address);
    setBusy(false);
    if (error !== null || gym === null) {
      setErrors({ form: error ?? undefined });
      return;
    }
    await choose(gym);
  }

  const searchActive = query.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={back} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} accessibilityLabel={t('gym.picker.close')} />
        {/* Top inset: with the keyboard up the sheet shrinks instead of sliding under the status bar. */}
        <KeyboardAvoidingView behavior="padding" style={[styles.kav, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View style={[styles.sheet, { height: sheetHeight, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.header}>
              {step !== 'search' ? (
                <TouchableOpacity style={styles.iconBtn} onPress={back} accessibilityRole="button" accessibilityLabel={t('common.back')}>
                  <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
              ) : <View style={styles.iconBtn} />}
              <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
                {step === 'search' ? title : step === 'add' ? t('gym.picker.addTitle') : t('gym.picker.similarTitle')}
              </Text>
              <TouchableOpacity style={styles.iconBtn} onPress={onClose} disabled={busy} accessibilityRole="button" accessibilityLabel={t('gym.picker.close')}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {step === 'search' && (
              <>
                <View style={styles.searchField}>
                  <Ionicons name="search" size={18} color={colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t('gym.picker.searchPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                    autoCorrect={false}
                    returnKeyType="search"
                    accessibilityLabel={t('gym.picker.searchLabel')}
                  />
                  {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')} hitSlop={12} accessibilityLabel={t('gym.picker.clearSearch')}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {currentGymId !== null && onRemove !== undefined && !searchActive && (
                  <TouchableOpacity style={styles.removeRow} onPress={() => { void remove(); }} disabled={busy} accessibilityRole="button">
                    <Ionicons name="remove-circle-outline" size={20} color={colors.deleteRed} />
                    <Text style={styles.removeText}>{removeLabel ?? t('gym.picker.remove')}</Text>
                  </TouchableOpacity>
                )}

                {!searchActive ? (
                  <Text style={styles.hint}>{t('gym.picker.searchHint')}</Text>
                ) : status === 'loading' && results.length === 0 ? (
                  <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
                ) : status === 'error' ? (
                  <View style={styles.stateBox}>
                    <Text style={styles.hint}>{t('gym.picker.searchFailed')}</Text>
                    <TouchableOpacity style={styles.textBtn} onPress={retry} accessibilityRole="button">
                      <Text style={styles.textBtnLabel}>{t('common.retry')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <FlatList
                    data={results}
                    keyExtractor={(g) => g.id}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    style={styles.list}
                    ListEmptyComponent={status === 'ready'
                      ? <Text style={styles.hint}>{t('gym.picker.noMatch')}</Text>
                      : null}
                    renderItem={({ item }) => (
                      <GymRow gym={item} selected={item.id === currentGymId} disabled={busy} onPress={() => { void choose(item); }} />
                    )}
                    ListFooterComponent={(
                      <TouchableOpacity style={styles.addRow} onPress={startAdd} accessibilityRole="button">
                        <Ionicons name="add-circle-outline" size={22} color={colors.accentBlueText} />
                        <View style={styles.flex}>
                          <Text style={styles.addTitle}>{t('gym.picker.addTitle')}</Text>
                          <Text style={styles.addSub}>{t('gym.picker.addSub')}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </>
            )}

            {step === 'add' && (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
                <Field label={t('gym.picker.fieldName')} value={name} onChange={setName} max={GYM_LIMITS.name} error={errors.name} autoFocus />
                <Field label={t('gym.picker.fieldCity')} value={city} onChange={setCity} max={GYM_LIMITS.city} error={errors.city} />
                <Field label={t('gym.picker.fieldAddress')} value={address} onChange={setAddress} max={GYM_LIMITS.address} error={errors.address} />
                <Text style={styles.note}>
                  {t('gym.picker.sharedNote')}
                </Text>
                {errors.form !== undefined && <Text style={styles.error}>{errors.form}</Text>}
                <PrimaryButton icon="checkmark" label={t('common.next')} loading={busy} onPress={() => { void checkAndContinue(); }} />
              </ScrollView>
            )}

            {step === 'similar' && (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
                <Text style={styles.hint}>{t('gym.picker.similarHint')}</Text>
                {similar.map((g) => (
                  <GymRow key={g.id} gym={g} selected={g.id === currentGymId} disabled={busy} onPress={() => { void choose(g); }} />
                ))}
                {errors.form !== undefined && <Text style={styles.error}>{errors.form}</Text>}
                <TouchableOpacity style={styles.addRow} onPress={() => { void saveNew(); }} disabled={busy} accessibilityRole="button">
                  {busy ? <ActivityIndicator color={colors.accentBlue} /> : <Ionicons name="add-circle-outline" size={22} color={colors.accentBlueText} />}
                  <View style={styles.flex}>
                    <Text style={styles.addTitle}>{t('gym.picker.createNew', { name: name.trim() })}</Text>
                    <Text style={styles.addSub}>{city.trim()}</Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function GymRow({ gym, selected, disabled, onPress }: {
  gym: Gym; selected: boolean; disabled: boolean; onPress: () => void;
}): React.ReactElement {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${gym.name}, ${gym.city}${gym.address !== null ? `, ${gym.address}` : ''}`}
    >
      <View style={styles.flex}>
        <Text style={styles.rowName}>{gym.name}</Text>
        <Text style={styles.rowCity}>
          {gym.city}{gym.address !== null && gym.address.trim().length > 0 ? ` – ${gym.address}` : ''}
        </Text>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color={colors.accentBlue} />}
    </TouchableOpacity>
  );
}

function Field({ label, value, onChange, max, error, autoFocus = false }: {
  label: string; value: string; onChange: (v: string) => void; max: number; error?: string; autoFocus?: boolean;
}): React.ReactElement {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, error !== undefined && styles.inputError]}
        value={value}
        onChangeText={onChange}
        maxLength={max}
        autoFocus={autoFocus}
        autoCapitalize="words"
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
      />
      {error !== undefined && <Text style={styles.error}>{error}</Text>}
    </View>
  );
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
  searchField: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    minHeight:         48,
    paddingHorizontal: 16,
    borderRadius:      16,
    backgroundColor:   colors.card,
    borderWidth:       1,
    borderColor:       colors.hairline,
  },
  searchInput: {
    flex:            1,
    fontSize:        16,
    color:           colors.text,
    paddingVertical: 8,
  },
  list: {
    flex: 1,
  },
  loader: {
    marginTop: 24,
  },
  hint: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.textMuted,
  },
  stateBox: {
    gap: 8,
  },
  textBtn: {
    minHeight:      44,
    justifyContent: 'center',
    alignSelf:      'flex-start',
  },
  textBtnLabel: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    minHeight:         56,
    paddingVertical:   8,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  flex: {
    flex: 1,
  },
  rowName: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.text,
  },
  rowCity: {
    fontSize: 14,
    color:    colors.textMuted,
  },
  removeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    minHeight:     44,
  },
  removeText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.deleteRed,
  },
  addRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    minHeight:       56,
    paddingVertical: 16,
  },
  addTitle: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
  addSub: {
    fontSize: 13,
    color:    colors.textMuted,
  },
  form: {
    gap:           16,
    paddingBottom: 24,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.text,
  },
  input: {
    minHeight:         48,
    paddingHorizontal: 16,
    borderRadius:      16,
    borderWidth:       1,
    borderColor:       colors.fieldBorder,
    backgroundColor:   colors.card,
    fontSize:          16,
    color:             colors.text,
  },
  inputError: {
    borderColor: colors.deleteRed,
  },
  error: {
    fontSize: 13,
    color:    colors.deleteRed,
  },
  note: {
    fontSize:   13,
    lineHeight: 18,
    color:      colors.textMuted,
  },
});
