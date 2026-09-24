import React, { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../navigation/types';
import {
  SPARRING_CONSENT_CHECKBOX_LABEL,
  SPARRING_CONSENT_ITEMS,
  SPARRING_RULES_INTRO,
  SPARRING_RULES_VERSION,
} from '../../data/sparringRules';

interface Props {
  visible: boolean;
  /** Title of the sparring the user is about to join — shown for context. */
  sparringTitle: string | null;
  loading: boolean;
  onClose: () => void;
  /** Called with the accepted rules version once the user confirms. */
  onConfirm: (rulesVersion: number) => void;
}

// Consent gate shown before every sparring signup. The user must tick the
// checkbox before "Teilnahme bestätigen" becomes active; the accepted version
// is handed back so it can be stored with the signup.
export default function SparringRulesConsentSheet({
  visible,
  sparringTitle,
  loading,
  onClose,
  onConfirm,
}: Props): React.ReactElement | null {
  const [accepted, setAccepted] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Consent is per signup — never carry a tick over to the next sparring.
  useEffect(() => {
    if (!visible) setAccepted(false);
  }, [visible]);

  if (!visible) return null;

  function handleConfirm(): void {
    if (!accepted || loading) return;
    onConfirm(SPARRING_RULES_VERSION);
  }

  return (
    // onRequestClose covers the Android hardware back button — it closes the
    // sheet without signing the user up.
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

        <Text style={styles.title}>Bevor du teilnimmst</Text>
        {sparringTitle !== null && (
          <Text style={styles.subtitle}>{sparringTitle}</Text>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introCard}>
            <Text style={styles.introTitle}>{SPARRING_RULES_INTRO.title}</Text>
            <Text style={styles.introBody}>{SPARRING_RULES_INTRO.paragraphs[0]}</Text>
          </View>

          <Text style={styles.listIntro}>Mit deiner Zusage bestätigst du:</Text>

          {SPARRING_CONSENT_ITEMS.map((item) => (
            <View key={item} style={styles.item}>
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={colors.accentBlue}
              />
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}

          <TouchableOpacity
            style={styles.rulesLink}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('SparringRules')}
          >
            <Ionicons name="document-text-outline" size={16} color={colors.accentBlue} />
            <Text style={styles.rulesLinkText}>Alle Sparr-Grundregeln lesen</Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity
          style={styles.checkboxRow}
          activeOpacity={0.7}
          onPress={() => setAccepted((prev) => !prev)}
        >
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
            {accepted && <Ionicons name="checkmark" size={16} color={colors.headerTextPrimary} />}
          </View>
          <Text style={styles.checkboxLabel}>{SPARRING_CONSENT_CHECKBOX_LABEL}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmBtn, (!accepted || loading) && styles.confirmBtnDisabled]}
          activeOpacity={0.8}
          disabled={!accepted || loading}
          onPress={handleConfirm}
        >
          {loading
            ? <ActivityIndicator color={colors.headerTextPrimary} />
            : <Text style={styles.confirmBtnText}>Teilnahme bestätigen</Text>}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: colors.mapOverlay,
  },
  sheet: {
    backgroundColor:      colors.card,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    24,
    paddingBottom:        48,
    gap:                  16,
    maxHeight:            '85%',
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 8,
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
  title: {
    fontSize:   20,
    fontWeight: '700',
    color:      colors.text,
  },
  subtitle: {
    fontSize:  14,
    color:     colors.textSecondary,
    marginTop: -8,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 8,
    gap:           8,
  },
  introCard: {
    backgroundColor: colors.accentBlueSoft,
    borderRadius:    16,
    padding:         16,
    gap:             8,
    marginBottom:    8,
  },
  introTitle: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.text,
  },
  introBody: {
    fontSize:   14,
    lineHeight: 21,
    color:      colors.text,
  },
  listIntro: {
    fontSize:     14,
    fontWeight:   '600',
    color:        colors.textSecondary,
    marginBottom: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
    marginBottom:  8,
  },
  itemText: {
    flex:       1,
    fontSize:   14,
    lineHeight: 21,
    color:      colors.text,
  },
  rulesLink: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    paddingTop:    8,
  },
  rulesLinkText: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.accentBlue,
  },
  checkboxRow: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             8,
    paddingTop:      8,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
  },
  checkbox: {
    width:           24,
    height:          24,
    borderRadius:    8,
    borderWidth:     2,
    borderColor:     colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accentBlue,
    borderColor:     colors.accentBlue,
  },
  checkboxLabel: {
    flex:       1,
    fontSize:   14,
    lineHeight: 21,
    color:      colors.text,
  },
  confirmBtn: {
    backgroundColor: colors.dark,
    borderRadius:    16,
    height:          56,
    alignItems:      'center',
    justifyContent:  'center',
  },
  confirmBtnDisabled: {
    backgroundColor: colors.inactive,
  },
  confirmBtnText: {
    color:      colors.headerTextPrimary,
    fontSize:   16,
    fontWeight: '700',
  },
});
