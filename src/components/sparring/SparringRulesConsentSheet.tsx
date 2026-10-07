import React, { useEffect, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import SparringRulesContent from './SparringRulesContent';
import {
  SPARRING_CONSENT_CHECKBOX_LABEL,
  SPARRING_CONSENT_ITEMS,
  SPARRING_RULES_INTRO,
  SPARRING_RULES_VERSION,
} from '../../data/sparringRules';
import { useTranslation } from 'react-i18next';
import { useLocalized } from '../../i18n/language';

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
  const { t } = useTranslation();
  const tx = useLocalized();
  const [accepted, setAccepted] = useState(false);
  // Full rules text shown as an overlay on top of this sheet. Navigating to the
  // SparringRules screen would land behind the open Modals and stay invisible.
  const [rulesOpen, setRulesOpen] = useState(false);
  const insets = useSafeAreaInsets();

  // "Ganz nach unten" hint: visible while the consent list overflows and the
  // user has not reached its end yet. Tapping it scrolls there.
  const scrollRef = useRef<ScrollView>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight,  setContentHeight]  = useState(0);
  const [scrollOffset,   setScrollOffset]   = useState(0);
  const showScrollHint =
    viewportHeight > 0 && scrollOffset + viewportHeight < contentHeight - SCROLL_END_TOLERANCE;

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>): void {
    setScrollOffset(e.nativeEvent.contentOffset.y);
  }

  // Consent is per signup — never carry a tick over to the next sparring.
  useEffect(() => {
    if (!visible) {
      setAccepted(false);
      setRulesOpen(false);
      setScrollOffset(0);
    }
  }, [visible]);

  if (!visible) return null;

  function handleConfirm(): void {
    if (!accepted || loading) return;
    onConfirm(SPARRING_RULES_VERSION);
  }

  return (
    // onRequestClose covers the Android hardware back button — it closes the
    // rules overlay first, otherwise the sheet without signing the user up.
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={rulesOpen ? () => setRulesOpen(false) : onClose}
    >
      {/* The dim overlay fills the whole screen (not just the area above the
          sheet), so nothing bright shows through behind the rounded corners. */}
      <View style={styles.overlay}>
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

          <Text style={styles.title}>{t('sparring.consent.title')}</Text>
          {sparringTitle !== null && (
            <Text style={styles.subtitle}>{sparringTitle}</Text>
          )}

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
            onContentSizeChange={(_w, h) => setContentHeight(h)}
            onScroll={handleScroll}
            scrollEventThrottle={32}
          >
            <View style={styles.introCard}>
              <Text style={styles.introTitle}>{tx(SPARRING_RULES_INTRO.title)}</Text>
              <Text style={styles.introBody}>{tx(SPARRING_RULES_INTRO.paragraphs[0])}</Text>
            </View>

            <Text style={styles.listIntro}>{t('sparring.consent.listIntro')}</Text>

            {SPARRING_CONSENT_ITEMS.map((item) => (
              <View key={item.de} style={styles.item}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={colors.accentBlue}
                />
                <Text style={styles.itemText}>{tx(item)}</Text>
              </View>
            ))}

            <TouchableOpacity
              style={styles.rulesLink}
              activeOpacity={0.7}
              onPress={() => setRulesOpen(true)}
            >
              <Ionicons name="document-text-outline" size={16} color={colors.accentBlue} />
              <Text style={styles.rulesLinkText}>{t('sparring.consent.readAll')}</Text>
            </TouchableOpacity>
          </ScrollView>

          {showScrollHint && (
            <TouchableOpacity
              style={styles.scrollHint}
              activeOpacity={0.7}
              onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              <Ionicons name="arrow-down-circle" size={22} color={colors.accentBlue} />
              <Text style={styles.scrollHintText}>{t('sparring.consent.scrollDown')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.checkboxRow}
            activeOpacity={0.7}
            onPress={() => setAccepted((prev) => !prev)}
          >
            <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
              {accepted && <Ionicons name="checkmark" size={16} color={colors.headerTextPrimary} />}
            </View>
            <Text style={styles.checkboxLabel}>{tx(SPARRING_CONSENT_CHECKBOX_LABEL)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmBtn, (!accepted || loading) && styles.confirmBtnDisabled]}
            activeOpacity={0.8}
            disabled={!accepted || loading}
            onPress={handleConfirm}
          >
            {loading
              ? <ActivityIndicator color={colors.headerTextPrimary} />
              : <Text style={styles.confirmBtnText}>{t('sparring.consent.confirm')}</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {rulesOpen && (
        <View style={[styles.rulesOverlay, { paddingTop: insets.top }]}>
          <View style={styles.rulesHeader}>
            <Text style={styles.rulesHeaderTitle}>{t('sparring.consent.rulesTitle')}</Text>
            <TouchableOpacity
              style={styles.rulesCloseBtn}
              onPress={() => setRulesOpen(false)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={colors.headerTextPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.rulesScroll}
            contentContainerStyle={[styles.rulesContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            <SparringRulesContent />
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

// Distance from the end (px) that already counts as "scrolled to the bottom".
const SCROLL_END_TOLERANCE = 8;

const styles = StyleSheet.create({
  scrollHint: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    minHeight:      44,
  },
  scrollHintText: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.accentBlue,
  },
  rulesOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.dark,
  },
  rulesHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingTop:        8,
    paddingBottom:     16,
  },
  rulesHeaderTitle: {
    color:      colors.headerTextPrimary,
    fontSize:   22,
    fontWeight: '700',
  },
  rulesCloseBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: colors.headerCard,
    alignItems:      'center',
    justifyContent:  'center',
  },
  rulesScroll: {
    flex:            1,
    backgroundColor: colors.background,
  },
  rulesContent: {
    paddingHorizontal: 16,
    paddingTop:        24,
  },
  overlay: {
    flex:            1,
    justifyContent:  'flex-end',
    backgroundColor: colors.mapOverlay,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
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
