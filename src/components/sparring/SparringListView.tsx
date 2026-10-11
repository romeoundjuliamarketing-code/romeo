import React, { useCallback } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { SearchRadius } from '../../utils/sparringSearch';
import { compactDateLabel, sparringLocationLines } from '../../utils/sparringDetail';
import { formatDistanceKm } from '../../utils/sparringSearch';
import { getInitials } from '../../utils/initials';
import type { NearbySparring, NearbyStatus } from '../../hooks/useNearbySparrings';
import type { SearchLocationStatus } from '../../hooks/useSearchLocation';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../i18n/language';
import { disciplineLabel } from '../../utils/disciplineLabel';
import { useTourTarget } from '../../context/TourContext';

interface Props {
  sparrings:      NearbySparring[];
  status:         NearbyStatus;
  locationStatus: SearchLocationStatus;
  radiusKm:       SearchRadius;
  currentUserId:  string | null;
  /** Space above the first row (overlaying search bar) and below the last. */
  topInset:       number;
  bottomInset:    number;
  onPress:        (s: NearbySparring) => void;
  onRetry:        () => void;
  onPickLocation: () => void;
  onWiden:        (() => void) | null;
  onCreate:       () => void;
  /** Opens the search panel (place, radius). */
  onAdjust:       () => void;
}

// List view of the nearby search — the same hits as the map markers, nearest
// first. Shows only fields the search delivers; nothing is filled in.
export default function SparringListView({
  sparrings, status, locationStatus, radiusKm, currentUserId, topInset, bottomInset,
  onPress, onRetry, onPickLocation, onWiden, onCreate, onAdjust,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  // Coach tour station 3 highlights the first hit.
  const tourFirst = useTourTarget('discoverFirst');
  const renderItem = useCallback(
    ({ item, index }: { item: NearbySparring; index: number }) => {
      const row = <SparringListRow sparring={item} isOwn={item.created_by === currentUserId} onPress={onPress} />;
      return index === 0
        ? <View ref={tourFirst.ref} onLayout={tourFirst.onLayout} collapsable={false}>{row}</View>
        : row;
    },
    [currentUserId, onPress, tourFirst.ref, tourFirst.onLayout],
  );

  const contentStyle = { paddingTop: topInset, paddingBottom: bottomInset };

  let empty: React.ReactElement | null = null;
  if (locationStatus === 'none') {
    empty = (
      <Notice text={t('map.list.pickPlace')}>
        <NoticeAction label={t('map.search.chooseLocation')} icon="location-outline" onPress={onPickLocation} />
      </Notice>
    );
  } else if (status === 'error') {
    empty = (
      <Notice text={t('map.list.loadFailed')}>
        <NoticeAction label={t('common.retry')} icon="refresh" onPress={onRetry} />
      </Notice>
    );
  } else if (locationStatus === 'loading' || status === 'loading' || status === 'idle') {
    empty = (
      <View style={styles.notice}>
        <ActivityIndicator color={colors.accentBlue} />
      </View>
    );
  } else {
    empty = (
      <Notice title={t('map.list.emptyTitle')} text={t('map.list.emptyText')}>
        <NoticeAction label={t('map.list.adjust')} icon="options-outline" onPress={onAdjust} />
        {onWiden !== null && <NoticeAction label={t('map.preview.widen')} icon="resize-outline" onPress={onWiden} />}
        <NoticeAction label={t('map.list.offerSubscription')} icon="add-circle-outline" onPress={onCreate} />
      </Notice>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={status === 'error' || locationStatus === 'none' ? [] : sparrings}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={[styles.content, contentStyle]}
      ListEmptyComponent={empty}
      ListFooterComponent={sparrings.length > 0 ? <Text style={styles.footnote}>{t('map.list.footnote')}</Text> : null}
      showsVerticalScrollIndicator={false}
    />
  );
}

function keyExtractor(item: NearbySparring): string {
  return item.id;
}

const SparringListRow = React.memo(function SparringListRow({
  sparring, isOwn, onPress,
}: {
  sparring: NearbySparring;
  isOwn:    boolean;
  onPress:  (s: NearbySparring) => void;
}) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const location = sparringLocationLines({
    studioId:   sparring.studio_id,
    studioName: sparring.studio_name,
    studioCity: sparring.studio_city,
    address:    sparring.address,
  });
  const slotsLeft = sparring.max_slots - sparring.signup_count;
  const full = slotsLeft <= 0;
  const slotsLabel = full ? t('map.list.fullWaitlist') : t('sparring.detailHeader.slotsFree', { count: slotsLeft });
  const ownStatus = isOwn
    ? t('sparring.detailHeader.yours')
    : sparring.my_status === 'pending' || sparring.my_status === 'confirmed'
      ? t('sparring.commitment.youAreIn')
      : sparring.my_status === 'waitlisted'
        ? t('map.list.onWaitlist')
        : null;
  const distance = formatDistanceKm(sparring.distance_km);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onPress(sparring)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t('map.list.rowA11y', { discipline: disciplineLabel(sparring.discipline, language), date: compactDateLabel(sparring.scheduled_at), place: location.primary, distance, slots: slotsLabel })}
    >
      <View style={styles.rowTop}>
        <Text style={styles.date} numberOfLines={1}>{compactDateLabel(sparring.scheduled_at)}</Text>
        <Text style={styles.distance}>{distance}</Text>
      </View>

      <Text style={styles.discipline} numberOfLines={1}>{disciplineLabel(sparring.discipline, language)}</Text>
      <Text style={styles.place} numberOfLines={1}>{location.primary}</Text>

      <View style={styles.rowBottom}>
        <View style={styles.host}>
          <View style={styles.avatar}>
            {sparring.host_avatar_url !== null && sparring.host_avatar_url.length > 0 ? (
              <Image source={{ uri: sparring.host_avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitials}>{getInitials(sparring.host_name)}</Text>
            )}
          </View>
          {sparring.host_name !== null && (
            <Text style={styles.hostName} numberOfLines={1}>{sparring.host_name}</Text>
          )}
        </View>
        <View style={styles.tags}>
          {ownStatus !== null && <Text style={[styles.tag, styles.tagAccent]}>{ownStatus}</Text>}
          <Text style={[styles.tag, full && styles.tagMuted]}>{slotsLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

function Notice({ title, text, children }: { title?: string; text: string; children: React.ReactNode }) {
  return (
    <View style={styles.notice}>
      {title !== undefined && <Text style={styles.noticeTitle} accessibilityRole="header">{title}</Text>}
      <Text style={styles.noticeText}>{text}</Text>
      <View style={styles.noticeActions}>{children}</View>
    </View>
  );
}

function NoticeAction({ label, icon, onPress }: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.noticeAction} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <Ionicons name={icon} size={18} color={colors.accentBlue} />
      <Text style={styles.noticeActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const AVATAR = 32;

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 16,
    gap: 8,
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  date: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.accentBlue,
  },
  distance: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  discipline: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  place: {
    fontSize: 14,
    color: colors.textMuted,
  },
  rowBottom: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  host: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: AVATAR,
    height: AVATAR,
  },
  avatarInitials: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  hostName: {
    flexShrink: 1,
    fontSize: 13,
    color: colors.text,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 1,
  },
  tag: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagMuted: {
    color: colors.textMuted,
  },
  tagAccent: {
    color: colors.accentBlue,
    backgroundColor: colors.accentBlueSoft,
  },
  footnote: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  notice: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  noticeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  noticeText: {
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
  },
  noticeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 24,
  },
  noticeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  noticeActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accentBlue,
  },
});
