import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import ChallengeCard from './ChallengeCard';
import ChallengeHeader from './ChallengeHeader';
import { useTranslation } from 'react-i18next';
import { useCardSize } from './cardLayout';
import type { CardSize } from './cardLayout';

interface Props {
  visible:      boolean;
  cards:        SparringChallenge[];
  areaTitle:    string;
  onClose:      () => void;
}

interface PageProps {
  card:      SparringChallenge;
  index:     number;
  scrollX:   SharedValue<number>;
  pageWidth: number;
  size:      CardSize;
}

// A single page — neighbouring cards shrink slightly so the active one stands out.
function BrowserPage({
  card,
  index,
  scrollX,
  pageWidth,
  size,
}: PageProps): React.ReactElement {
  const style = useAnimatedStyle(() => {
    const offset = scrollX.value / pageWidth;
    const scale = interpolate(
      offset,
      [index - 1, index, index + 1],
      [0.9, 1, 0.9],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      offset,
      [index - 1, index, index + 1],
      [0.4, 1, 0.4],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }] };
  });

  return (
    <View style={[styles.page, { width: pageWidth }]}>
      <Animated.View style={style}>
        <ChallengeCard challenge={card} size={size} />
      </Animated.View>
    </View>
  );
}

// Full-screen browser over every card of the active area.
export default function ChallengeBrowser({
  visible,
  cards,
  areaTitle,
  onClose,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const { width: pageWidth } = useWindowDimensions();
  const cardSize = useCardSize(0.58);
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Own provider — see ChallengeAreaPicker: opened from a sheet screen, but covers
          the whole screen, so it needs the real window insets. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <ChallengeHeader
            title={areaTitle}
            icon="close"
            iconLabel={t('challenge.browser.close')}
            onPress={onClose}
          />

          {cards.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('challenge.noCards')}</Text>
            </View>
          ) : (
            <Animated.ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              contentContainerStyle={styles.scrollContent}
            >
              {cards.map((card, index) => (
                <BrowserPage
                  key={card.id}
                  card={card}
                  index={index}
                  scrollX={scrollX}
                  pageWidth={pageWidth}
                  size={cardSize}
                />
              ))}
            </Animated.ScrollView>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  scrollContent: {
    alignItems: 'center',
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.headerTextSecondary,
  },
});
