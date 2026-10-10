import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme/colors';

// Three faint, abstract ring ropes in the right part of the event ticket.
// Pure background: no layout room, no touches, hidden from screen readers.
function TicketRopes(): React.ReactElement {
  return (
    <View
      style={styles.layer}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Svg style={styles.svg} viewBox="0 0 200 240" preserveAspectRatio="xMaxYMid slice">
        <Path d="M20 40 C 80 56, 140 52, 220 24" stroke={colors.ticketRope} strokeWidth="6" strokeLinecap="round" fill="none" />
        <Path d="M0 104 C 70 120, 140 116, 220 88" stroke={colors.ticketRope} strokeWidth="6" strokeLinecap="round" fill="none" />
        <Path d="M-20 168 C 60 184, 140 180, 220 152" stroke={colors.ticketRope} strokeWidth="6" strokeLinecap="round" fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    left: '45%',
  },
  svg: {
    width: '100%',
    height: '100%',
  },
});

export default React.memo(TicketRopes);
