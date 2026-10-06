import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FocusedStatusBar from '../common/FocusedStatusBar';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import SparrLogo from '../common/SparrLogo';
import BrandHeroBackground from '../common/BrandHeroBackground';

interface ScaffoldProps {
  title:     string;
  subtitle:  string;
  onBack?:   () => void;
  children:  React.ReactNode;
  footer:    React.ReactNode;
}

// Shared frame of the login and register screens: a compact deep-blue hero
// with the penguin logo, and the light form surface overlapping it with large
// rounded top corners. Scrolls and avoids the keyboard; safe areas are applied
// manually because the hero draws under the status bar.
export default function AuthScaffold({ title, subtitle, onBack, children, footer }: ScaffoldProps): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      {/* Light status bar icons on the deep-blue hero */}
      <FocusedStatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        // Edge-to-edge (SDK 55): the window no longer resizes for the keyboard
        // on Android either, so both platforms need padding.
        behavior="padding"
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          // No bounce: pulling down would reveal the surface color above the hero.
          bounces={false}
          overScrollMode="never"
        >
          <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
            <BrandHeroBackground />
            <View style={styles.heroInner}>
              {onBack !== undefined && (
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={onBack}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.common.goBack')}
                >
                  <Ionicons name="arrow-back" size={20} color={colors.card} />
                </TouchableOpacity>
              )}
              <View style={styles.logoRow}>
                {/* Light disc keeps the original logo (dark outline) readable on deep blue */}
                <View style={styles.logoDisc}>
                  <SparrLogo size={64} />
                </View>
                <View style={styles.logoAccent} />
              </View>
              <Text style={styles.title} accessibilityRole="header">{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
          </View>

          <View style={[styles.surface, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.surfaceInner}>
              <View style={styles.form}>{children}</View>
              <View style={styles.footer}>{footer}</View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

interface ButtonProps {
  label:    string;
  loading:  boolean;
  onPress:  () => void;
}

// Primary action of an auth screen: royal blue with a soft shadow.
export function AuthButton({ label, loading, onPress }: ButtonProps): React.ReactElement {
  return (
    <TouchableOpacity
      style={[styles.button, loading && styles.buttonBusy]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: loading, busy: loading }}
    >
      {loading
        ? <ActivityIndicator color={colors.card} />
        : <Text style={styles.buttonText}>{label}</Text>}
    </TouchableOpacity>
  );
}

// Form-level message that belongs to no single field (e.g. wrong credentials).
export function AuthNotice({ text, tone }: { text: string; tone: 'error' | 'info' }): React.ReactElement {
  const color = tone === 'error' ? colors.deleteRed : colors.brandPrimary;
  return (
    <View
      style={[styles.notice, tone === 'error' ? styles.noticeError : styles.noticeInfo]}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={tone === 'error' ? 'alert-circle' : 'mail-outline'} size={18} color={color} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

// Shown when the Cloudflare check could not load; the action still works.
export function AuthCaptchaNotice({ actionLabel, onRetry }: { actionLabel: string; onRetry: () => void }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.captchaRow}>
      <Text style={styles.captchaText}>{t('auth.common.captchaUnavailable', { action: actionLabel })}</Text>
      <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button">
        <Text style={styles.captchaRetry}>{t('auth.common.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// "Text Link" row used to switch between login and register.
export function AuthSwitch({ text, link, onPress }: { text: string; link: string; onPress: () => void }): React.ReactElement {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchText}>{text}</Text>
      <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button">
        <Text style={styles.switchLink}>{link}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Surface overlaps the hero by this much, so the rounded corners sit on blue.
const SURFACE_OVERLAP = 32;

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.brandSurface,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    paddingHorizontal: 24,
    paddingBottom:     24 + SURFACE_OVERLAP,
    overflow:          'hidden',
  },
  heroInner: {
    width:     '100%',
    maxWidth:  480,
    alignSelf: 'center',
    gap:       8,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.brandHeroChip,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    marginBottom:  8,
  },
  logoDisc: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: colors.card,
    alignItems:      'center',
    justifyContent:  'center',
  },
  logoAccent: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: colors.brandAccent,
    marginLeft:      -8,
    marginBottom:    8,
  },
  title: {
    fontSize:      30,
    fontWeight:    '800',
    letterSpacing: -0.5,
    color:         colors.card,
  },
  subtitle: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.brandHeroText,
  },
  surface: {
    flexGrow:             1,
    marginTop:            -SURFACE_OVERLAP,
    backgroundColor:      colors.brandSurface,
    borderTopLeftRadius:  32,
    borderTopRightRadius: 32,
    paddingHorizontal:    24,
    paddingTop:           32,
  },
  surfaceInner: {
    width:     '100%',
    maxWidth:  480,
    alignSelf: 'center',
  },
  form: {
    gap: 16,
  },
  footer: {
    paddingTop: 24,
  },
  button: {
    minHeight:       56,
    borderRadius:    16,
    backgroundColor: colors.brandPrimary,
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 16,
    // Soft royal-blue shadow, kept subtle
    shadowColor:     colors.brandPrimary,
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.25,
    shadowRadius:    16,
    elevation:       4,
  },
  buttonBusy: {
    opacity: 0.75,
  },
  buttonText: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.card,
  },
  notice: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
    padding:       16,
    borderRadius:  16,
  },
  noticeError: {
    backgroundColor: colors.deleteRedSoft,
  },
  noticeInfo: {
    backgroundColor: colors.brandPrimarySoft,
  },
  noticeText: {
    flex:       1,
    fontSize:   14,
    lineHeight: 20,
    color:      colors.brandInk,
  },
  captchaRow: {
    alignItems: 'center',
    gap:        8,
  },
  captchaText: {
    fontSize:  13,
    color:     colors.brandMuted,
    textAlign: 'center',
  },
  captchaRetry: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.brandPrimary,
  },
  switchRow: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'center',
    alignItems:     'center',
    gap:            8,
  },
  switchText: {
    fontSize: 15,
    color:    colors.brandMuted,
  },
  switchLink: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.brandPrimary,
  },
});
