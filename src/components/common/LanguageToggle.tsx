// Compact DE | EN switch for screens without access to Settings (welcome, login).
// A choice made before login wins over an older profile value (pending flag in
// src/i18n/language.ts) and is uploaded after sign-in.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/language';
import { APP_LANGUAGES, type AppLanguage } from '../../utils/language';

const LABEL: Record<AppLanguage, string> = { de: 'DE', en: 'EN' };
const HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 };

export default function LanguageToggle(): React.ReactElement {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('settings.language')}>
      {APP_LANGUAGES.map((lang) => {
        const selected = lang === language;
        return (
          <TouchableOpacity
            key={lang}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => { if (!selected) void setLanguage(lang); }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={lang === 'de' ? t('settings.languageGerman') : t('settings.languageEnglish')}
            hitSlop={HIT_SLOP}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} maxFontSizeMultiplier={1.3}>
              {LABEL[lang]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius:  16,
    borderWidth:   1,
    borderColor:   colors.text,
    overflow:      'hidden',
  },
  segment: {
    minWidth:          40,
    minHeight:         32,
    paddingHorizontal: 8,
    alignItems:        'center',
    justifyContent:    'center',
  },
  segmentSelected: {
    backgroundColor: colors.text,
  },
  label: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.text,
  },
  labelSelected: {
    color: colors.card,
  },
});
