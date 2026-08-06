import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
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

const PAGE_WIDTH = Dimensions.get('window').width;

interface Props {
  visible:      boolean;
  cards:        SparringChallenge[];
  areaTitle:    string;
  onClose:      () => void;
  isDone:       (id: string) => boolean;
  onToggleDone: (id: string) => void;
}

interface PageProps {
  card:     SparringChallenge;
  index:    number;
  scrollX:  SharedValue<number>;
  done:     boolean;
  onToggle: () => void;
}

// A single page — neighbouring cards shrink slightly so the active one stands out.
function BrowserPage({ card, index, scrollX, done, onToggle }: PageProps): React.ReactElement {
  const style = useAnimatedStyle(() => {
    const offset = scrollX.value / PAGE_WIDTH;
    const scale = interpolate(
      offset,
      [index - 1, index, index + 1],
      [0.88, 1, 0.88],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      offset,
      [index - 1, index, index + 1],
      [0.5, 1, 0.5],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }] };
  });

  return (
    <View style={styles.page}>
      <Animated.View style={style}>
        <ChallengeCard challenge={card} done={done} onToggleDone={onToggle} />
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
  const scrollX = useSharedValue(0);
  const [pageIndex, setPageIndex] = useState(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    setPageIndex(Math.round(event.nativeEvent.contentOffset.x / PAGE_WIDTH));
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
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Schliessen"
          >
            <Ionicons name="close" size={24} color={colors.headerTextPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{areaTitle}</Text>
          <View style={styles.closeBtn} />
        </View>

        {cards.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Für diesen Bereich gibt es noch keine Karten</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  scrollContent: {
    alignItems: 'center',
  },
  page: {
    width: PAGE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    paddingVertical: 24,
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
