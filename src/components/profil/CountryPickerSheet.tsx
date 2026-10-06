import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Modal,
  Pressable,
  TouchableOpacity,
  KeyboardAvoidingView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { searchCountries } from '../../utils/countries';
import type { Country } from '../../utils/countries';
import { useTranslation } from 'react-i18next';
import CountryFlag from '../common/CountryFlag';

interface Props {
  visible:  boolean;
  selected: string | null;
  onClose:  () => void;
  /** null removes the flag. */
  onSelect: (code: string | null) => void;
}

const ROW_HEIGHT = 56;

// Searchable country list for the flag under the profile name. Selection only
// changes the edit draft; saving happens with the rest of the profile.
export default function CountryPickerSheet({ visible, selected, onClose, onSelect }: Props): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sheetHeight = Math.round(useWindowDimensions().height * 0.88);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchCountries(query), [query]);

  // Every opening starts with an empty search.
  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  function choose(code: string | null): void {
    onSelect(code);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('profile.close')} />
        <KeyboardAvoidingView behavior="padding" style={[styles.kav, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View style={[styles.sheet, { height: sheetHeight, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.header}>
              <View style={styles.iconBtn} />
              <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{t('profile.country.title')}</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('profile.close')}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchField}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={t('profile.country.search')}
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel={t('profile.country.search')}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={12} accessibilityLabel={t('profile.country.clearSearch')}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {selected !== null && query.trim().length === 0 && (
              <TouchableOpacity style={styles.removeRow} onPress={() => choose(null)} accessibilityRole="button">
                <Ionicons name="remove-circle-outline" size={20} color={colors.deleteRed} />
                <Text style={styles.removeText}>{t('profile.country.none')}</Text>
              </TouchableOpacity>
            )}

            <FlatList
              data={results}
              keyExtractor={(c) => c.code}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={styles.list}
              initialNumToRender={14}
              windowSize={7}
              getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
              ListEmptyComponent={<Text style={styles.hint}>{t('profile.country.empty')}</Text>}
              renderItem={({ item }) => (
                <CountryRow country={item} selected={item.code === selected} onPress={() => choose(item.code)} />
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const CountryRow = React.memo(function CountryRow({ country, selected, onPress }: {
  country: Country; selected: boolean; onPress: () => void;
}): React.ReactElement {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={country.name}
    >
      <CountryFlag code={country.code} width={32} />
      <Text style={styles.rowName} numberOfLines={1}>{country.name}</Text>
      {selected && <Ionicons name="checkmark-circle" size={22} color={colors.accentBlue} />}
    </TouchableOpacity>
  );
});

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
  hint: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.textMuted,
  },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               16,
    height:            ROW_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  rowName: {
    flex:       1,
    fontSize:   16,
    fontWeight: '700',
    color:      colors.text,
  },
  removeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    minHeight:     48,
  },
  removeText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.deleteRed,
  },
});
