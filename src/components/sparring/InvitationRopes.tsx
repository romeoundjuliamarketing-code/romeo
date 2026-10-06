import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { colors } from '../../theme/colors';

// Three ring ropes across the upper right corner, the middle one in brand
// blue. Shared by the create preview and the story image so both look alike.
function InvitationRopes(): React.ReactElement {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 320 400" preserveAspectRatio="xMaxYMin slice" pointerEvents="none">
      <Line x1="150" y1="-10" x2="330" y2="70" stroke={colors.coverRope} strokeWidth="3" strokeLinecap="round" />
      <Line x1="190" y1="-10" x2="330" y2="52" stroke={colors.accentBlue} strokeWidth="3" strokeLinecap="round" opacity={0.6} />
      <Line x1="230" y1="-10" x2="330" y2="34" stroke={colors.coverRope} strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

export default React.memo(InvitationRopes);
