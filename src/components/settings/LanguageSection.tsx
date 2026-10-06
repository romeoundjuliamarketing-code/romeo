import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/language';
import { APP_LANGUAGES, type AppLanguage } from '../../utils/language';

const LABEL_KEY = {
  de: 'settings.languageGerman',
  en: 'settings.languageEnglish',
} as const satisfies Record<AppLanguage, string>;

export default function LanguageSection(): React.ReactElement {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();

  return (
    <View style={styles.card}>
      {APP_LANGUAGES.map((lang, i) => (
        <React.Fragment key={lang}>
          {i > 0 && <View style={styles.divider} />}
          <TouchableOpacity
            style={styles.row}
            onPress={() => { void setLanguage(lang); }}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityState={{ checked: language === lang }}
          >
            <MaterialCommunityIcons name="translate" size={20} color={colors.text} />
            <Text style={styles.rowLabel}>{t(LABEL_KEY[lang])}</Text>
            {language === lang && <MaterialCommunityIcons name="check" size={20} color={colors.accentBlue} />}
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </View>
  );
}

// Mirrors the card/row styles of SettingsScreen.
const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 48 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 16 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },
});
