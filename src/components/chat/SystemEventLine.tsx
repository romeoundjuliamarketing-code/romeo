import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { parseSystemMessage, type SystemEventKind } from '../../utils/systemMessageText';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const SYSTEM_EVENT_ICON: Record<SystemEventKind | 'other', IconName> = {
  joined:    'person-add-outline',
  cancelled: 'person-remove-outline',
  expired:   'person-remove-outline',
  other:     'information-circle-outline',
};

interface Props {
  content: string;
}

// One sign-up/cancellation as a quiet text line: small icon, the name slightly
// emphasised, the event text secondary. No filled background.
function SystemEventLine({ content }: Props) {
  const { t } = useTranslation();
  const parsed = parseSystemMessage(content, t('chat.system.someone'));

  let before = '';
  let name   = '';
  let after  = content;
  if (parsed !== null) {
    const full = t(parsed.key, { name: parsed.name });
    const at   = full.indexOf(parsed.name);
    if (at >= 0) {
      before = full.slice(0, at);
      name   = parsed.name;
      after  = full.slice(at + parsed.name.length);
    } else {
      after = full;
    }
  }

  return (
    <View style={styles.row}>
      <Ionicons name={SYSTEM_EVENT_ICON[parsed?.kind ?? 'other']} size={14} color={colors.textMuted} />
      <Text style={styles.text}>
        {before}
        {name.length > 0 && <Text style={styles.name}>{name}</Text>}
        {after}
      </Text>
    </View>
  );
}

export default React.memo(SystemEventLine);

const styles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 24,
    paddingVertical:   4,
    gap:               8,
  },
  text: {
    flexShrink: 1,
    fontSize:   13,
    lineHeight: 18,
    color:      colors.textMuted,
    textAlign:  'center',
  },
  name: {
    fontWeight: '600',
    color:      colors.text,
  },
});
