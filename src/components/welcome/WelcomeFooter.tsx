import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import LoginButton from '../auth/LoginButton';
import { LoginSwitch } from '../auth/LoginScaffold';
import WelcomeDots from './WelcomeDots';

interface Props {
  count:      number;
  index:      number;
  scrollX:    SharedValue<number>;
  pageWidth:  number;
  onBack:     () => void;
  onNext:     () => void;
  onRegister: () => void;
  onLogin:    () => void;
}

// Shared navigation below the welcome slides: progress dots, back + "Weiter"
// ("Konto erstellen" on the last slide) and the direct way to the login.
export default function WelcomeFooter({
  count, index, scrollX, pageWidth, onBack, onNext, onRegister, onLogin,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const isLast = index === count - 1;

  return (
    <View style={styles.footer}>
      <WelcomeDots count={count} index={index} scrollX={scrollX} pageWidth={pageWidth} />
      <View style={styles.actionRow}>
        {index > 0 && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t('auth.welcome.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        <View style={styles.primary}>
          <LoginButton
            label={isLast ? t('auth.welcome.createAccount') : t('auth.welcome.next')}
            loading={false}
            onPress={isLast ? onRegister : onNext}
          />
        </View>
      </View>
      <LoginSwitch text={t('auth.welcome.alreadyHere')} link={t('auth.welcome.login')} onPress={onLogin} />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 24,
    paddingTop:        16,
    gap:               16,
    alignItems:        'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignSelf:     'stretch',
    gap:           16,
  },
  backBtn: {
    width:           56,
    minHeight:       56,
    borderRadius:    16,
    borderWidth:     1.5,
    borderColor:     colors.fieldBorder,
    backgroundColor: colors.card,
    alignItems:      'center',
    justifyContent:  'center',
  },
  primary: {
    flex: 1,
  },
});
