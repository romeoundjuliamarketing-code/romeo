import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import ChallengeCard from './ChallengeCard';
import { useCardSize } from './cardLayout';
import type { CardSize } from './cardLayout';

interface Props {
  visible:      boolean;
  cards:        SparringChallenge[];
  areaTitle:    string;
  onClose:      () => void;
  isDone:       (id: string) => boolean;
  onToggleDone: (id: string) => void;
}

interface PageProps {
  card:      SparringChallenge;
  index:     number;
  scrollX:   SharedValue<number>;
  pageWidth: number;
  size:      CardSize;
  done:      boolean;
  onToggle:  () => void;
}

// A single page — neighbouring cards shrink slightly so the active one stands out.
function BrowserPage({
  card,
  index,
  scrollX,
  pageWidth,
  size,
  done,
  onToggle,
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
        <ChallengeCard challenge={card} size={size} done={done} onToggleDone={onToggle} />
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
  isDone,
  onToggleDone,
}: Props): React.ReactElement {
  const { width: pageWidth } = useWindowDimensions();
  const cardSize = useCardSize(0.58);
  const scrollX = useSharedValue(0);
  const [pageIndex, setPageIndex] = useState(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    setPageIndex(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Schliessen"
          >
            <Ionicons name="close" size={24} color={colors.headerTextPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{areaTitle}</Text>
          <View style={styles.headerBtn} />
        </View>

        {cards.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Noch keine Karten in diesem Bereich</Text>
          </View>
        ) : (
          <>
            <Animated.ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={scrollHandler}
              onMomentumScrollEnd={handleMomentumEnd}
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
                  done={isDone(card.id)}
                  onToggle={() => onToggleDone(card.id)}
                />
              ))}
            </Animated.ScrollView>

            <Text style={styles.counter}>
              {pageIndex + 1} von {cards.length}
            </Text>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  scrollContent: {
    alignItems: 'center',
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    paddingVertical: 16,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
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
