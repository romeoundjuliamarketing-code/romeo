import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { CARD_RADIUS } from './cardLayout';

const BENEFIT_KEYS = ['habits', 'timing', 'pressure', 'variety'] as const;
type BenefitKey = typeof BENEFIT_KEYS[number];

// Opening of the explanation, set like the start of a short article: open on the
// page background, no panel.
export function CardsWhy(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.why}>
      <Text style={styles.kicker}>{t('challenge.landing.whyKicker')}</Text>
      <Text style={styles.whyTitle} accessibilityRole="header">{t('challenge.landing.whyTitle')}</Text>
      <Text style={styles.lead}>{t('challenge.landing.whyBody')}</Text>
    </View>
  );
}

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
      <Text style={styles.exampleTitle} accessibilityRole="header">{t('challenge.landing.exampleTitle')}</Text>
      <View>
        <View style={styles.step}>
          <RailNode />
          <View style={styles.stepBody}>
            <Text style={styles.labelMuted}>{t('challenge.landing.exampleHabitLabel')}</Text>
            <Text style={styles.stepText}>{t('challenge.landing.exampleHabit')}</Text>
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
                  <Text style={styles.stepText}>{t('challenge.landing.exampleTaskBody')}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.step}>
          <RailNode last filled />
          <View style={[styles.stepBody, styles.stepBodyLast]}>
            <Text style={styles.labelBlue}>{t('challenge.landing.exampleFocusLabel')}</Text>
            <Text style={styles.stepText}>{t('challenge.landing.exampleFocus')}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.exampleNote}>{t('challenge.landing.exampleNote')}</Text>
    </View>
  );
}

function Benefit({ id, index, open, onToggle }: { id: BenefitKey; index: number; open: boolean; onToggle: () => void }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.benefit}>
      <Pressable
        style={({ pressed }) => [styles.benefitHead, pressed && styles.pressed]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={t(open ? 'challenge.landing.benefitCollapseHint' : 'challenge.landing.benefitExpandHint')}
      >
        <Text style={styles.benefitNumber}>{String(index + 1).padStart(2, '0')}</Text>
        <View style={styles.benefitText}>
          <Text style={styles.benefitTitle}>{t(`challenge.landing.benefits.${id}.title`)}</Text>
          <Text style={styles.benefitSummary}>{t(`challenge.landing.benefits.${id}.summary`)}</Text>
        </View>
        <Ionicons name={open ? 'remove' : 'add'} size={24} color={colors.accentBlueText} />
      </Pressable>
      {open ? <Text style={styles.benefitBody}>{t(`challenge.landing.benefits.${id}.body`)}</Text> : null}
    </View>
  );
}

// Four open sections to read on; titles and summaries always show, several can
// be open at once.
export function CardsBenefits(): React.ReactElement {
  const { t } = useTranslation();
  const [openKeys, setOpenKeys] = useState<ReadonlySet<BenefitKey>>(new Set());
  const toggle = (key: BenefitKey): void => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  return (
    <View style={styles.benefits}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{t('challenge.landing.benefitsTitle')}</Text>
      <View style={styles.benefitList}>
        {BENEFIT_KEYS.map((key, i) => (
          <Benefit key={key} id={key} index={i} open={openKeys.has(key)} onToggle={() => toggle(key)} />
        ))}
      </View>
    </View>
  );
}

// What the cards are and are not: training ideas, not technique instruction.
export function CardsHonestNote(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.honest}>
      <Text style={styles.honestTitle} accessibilityRole="header">{t('challenge.landing.honestTitle')}</Text>
      <Text style={styles.body}>{t('challenge.landing.honestBody')}</Text>
    </View>
  );
}

export function CardsClosingTitle(): React.ReactElement {
  const { t } = useTranslation();
  return <Text style={styles.closingTitle} accessibilityRole="header">{t('challenge.landing.closingTitle')}</Text>;
}

const styles = StyleSheet.create({
  why: { gap: 16 },
  kicker: { color: colors.accentBlueText, fontFamily: 'Inter_700Bold', fontSize: 12, lineHeight: 16, letterSpacing: 2 },
  whyTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  lead: { color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 17, lineHeight: 26 },
  body: { color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24 },
  sectionTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },

  // Highlighted example on a light brand-blue surface.
  example: { backgroundColor: colors.accentBlueTint, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 24, gap: 24 },
  exampleTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  step: { flexDirection: 'row', gap: 16 },
  rail: { width: 16, alignItems: 'center' },
  node: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.accentBlue, backgroundColor: colors.accentBlueTint, marginTop: 2 },
  nodeFilled: { backgroundColor: colors.accentBlue },
  railLine: { flex: 1, width: 2, marginVertical: 4, backgroundColor: colors.accentBlueMuted },
  stepBody: { flex: 1, gap: 8, paddingBottom: 24 },
  stepBodyLast: { paddingBottom: 0 },
  labelMuted: { color: colors.textMuted, fontFamily: 'Inter_700Bold', fontSize: 12, lineHeight: 16, letterSpacing: 1.5 },
  labelBlue: { color: colors.accentBlueText, fontFamily: 'Inter_700Bold', fontSize: 12, lineHeight: 16, letterSpacing: 1.5 },
  stepText: { color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24 },
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
  taskLabel: { color: colors.headerTextPrimary, fontFamily: 'Inter_700Bold', fontSize: 12, lineHeight: 16, letterSpacing: 1.5 },
  taskBody: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, gap: 8 },
  taskTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 26 },
  exampleNote: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 22 },

  benefits: { gap: 8 },
  benefitList: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  benefit: { borderTopWidth: 1, borderTopColor: colors.hairline, paddingBottom: 8 },
  benefitHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingTop: 16, paddingBottom: 8, minHeight: 56 },
  pressed: { opacity: 0.6 },
  benefitNumber: { width: 24, color: colors.accentBlueText, fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 24, fontVariant: ['tabular-nums'] },
  benefitText: { flex: 1, gap: 4 },
  benefitTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 24 },
  benefitSummary: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  // Indented under the title, past the chapter number.
  benefitBody: { marginLeft: 40, paddingBottom: 8, color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24 },

  honest: { gap: 8, borderLeftWidth: 4, borderLeftColor: colors.accentBlue, paddingLeft: 16 },
  honestTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 26 },
  closingTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 26, lineHeight: 32, letterSpacing: -0.3, textAlign: 'center' },
});
