import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { CARD_RADIUS } from './cardLayout';

const BENEFIT_KEYS = ['habits', 'timing', 'pressure'] as const;

// Left rail joining the three passages: a node per passage and a line down to the
// next one. `filled` marks the passage the card leads to.
function RailNode({ last, filled }: { last?: boolean; filled?: boolean }): React.ReactElement {
  return (
    <View style={styles.rail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.node, filled && styles.nodeFilled]} />
      {last === true ? null : <View style={styles.railLine} />}
    </View>
  );
}

// One round with "Finish with Lowkick": habit, the task as a small tilted card,
// and what you pay attention to now. An example of use, not a game mode.
export function CardsRoundExample(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.example}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{t('challenge.landing.exampleTitle')}</Text>
      <View>
        <View style={styles.step}>
          <RailNode />
          <View style={styles.stepBody}>
            <Text style={styles.labelMuted}>{t('challenge.landing.exampleHabitLabel')}</Text>
            <Text style={styles.body}>{t('challenge.landing.exampleHabit')}</Text>
          </View>
        </View>
        <View style={styles.step}>
          <RailNode />
          <View style={styles.stepBody}>
            <View style={styles.taskShadow}>
              <View style={styles.taskCard}>
                <View style={styles.taskHead}>
                  <Text style={styles.taskLabel}>{t('challenge.landing.exampleTaskLabel')}</Text>
                </View>
                <View style={styles.taskBody}>
                  <Text style={styles.taskTitle}>{t('challenge.landing.exampleTaskTitle')}</Text>
                  <Text style={styles.body}>{t('challenge.landing.exampleTaskBody')}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.step}>
          <RailNode last filled />
          <View style={[styles.stepBody, styles.stepBodyLast]}>
            <Text style={styles.labelBlue}>{t('challenge.landing.exampleFocusLabel')}</Text>
            <Text style={styles.body}>{t('challenge.landing.exampleFocus')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// Three short points: title and one line each.
export function CardsBenefits(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{t('challenge.landing.benefitsTitle')}</Text>
      <View style={styles.benefitList}>
        {BENEFIT_KEYS.map((key, i) => (
          <View key={key} style={styles.benefit}>
            <Text style={styles.benefitNumber}>{String(i + 1).padStart(2, '0')}</Text>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>{t(`challenge.landing.benefits.${key}.title`)}</Text>
              <Text style={styles.benefitSummary}>{t(`challenge.landing.benefits.${key}.summary`)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// Safety in one sentence: safe techniques, agreed rules.
export function CardsHonestNote(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.honest}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{t('challenge.landing.honestTitle')}</Text>
      <Text style={styles.body}>{t('challenge.landing.honestBody')}</Text>
    </View>
  );
}

export function CardsClosingTitle(): React.ReactElement {
  const { t } = useTranslation();
  return <Text style={[styles.sectionTitle, styles.centered]} accessibilityRole="header">{t('challenge.landing.closingTitle')}</Text>;
}

// Type scale of the page: 22 section headings, 16 body, 13 muted hints.
const styles = StyleSheet.create({
  section: { gap: 16 },
  sectionTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  centered: { textAlign: 'center' },
  body: { color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24 },

  // Highlighted example on a light brand-blue surface.
  example: { backgroundColor: colors.accentBlueTint, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 24, gap: 16 },
  step: { flexDirection: 'row', gap: 16 },
  rail: { width: 16, alignItems: 'center' },
  node: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.accentBlue, backgroundColor: colors.accentBlueTint, marginTop: 2 },
  nodeFilled: { backgroundColor: colors.accentBlue },
  railLine: { flex: 1, width: 2, marginVertical: 4, backgroundColor: colors.accentBlueMuted },
  stepBody: { flex: 1, gap: 8, paddingBottom: 16 },
  stepBodyLast: { paddingBottom: 0 },
  labelMuted: { color: colors.textMuted, fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 16, letterSpacing: 1.5 },
  labelBlue: { color: colors.accentBlueText, fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 16, letterSpacing: 1.5 },
  // Small playing card, slightly turned; the outer layer carries the shadow, the
  // inner one clips the head band to the rounded corners.
  taskShadow: {
    marginVertical: 8,
    marginRight: 8,
    borderRadius: CARD_RADIUS - 8,
    backgroundColor: colors.card,
    transform: [{ rotate: '-2deg' }],
    ...Platform.select({
      ios:     { shadowColor: colors.dark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  taskCard: { borderRadius: CARD_RADIUS - 8, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.card, overflow: 'hidden' },
  taskHead: { backgroundColor: colors.cardFaceHeader, paddingHorizontal: 16, paddingVertical: 8 },
  taskLabel: { color: colors.headerTextPrimary, fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 16, letterSpacing: 1.5 },
  taskBody: { padding: 16, gap: 8 },
  taskTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 16, lineHeight: 24 },

  benefitList: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, borderTopWidth: 1, borderTopColor: colors.hairline, paddingVertical: 16 },
  benefitNumber: { width: 24, color: colors.accentBlueText, fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 24, fontVariant: ['tabular-nums'] },
  benefitText: { flex: 1 },
  benefitTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 16, lineHeight: 24 },
  benefitSummary: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24 },

  honest: { gap: 16, borderLeftWidth: 4, borderLeftColor: colors.accentBlue, paddingLeft: 16 },
});
