import React, { useState } from 'react';
import { Alert, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { useSparringActions } from '../../hooks/useSparringActions';
import { hasStarted } from '../../utils/sparringCommitment';
import { initialsOf } from '../../utils/sparringDetail';
import type { SparringParticipant, SparringSignupStatus } from '../../types/database.types';

// Maps DB gender value to short display label
const GENDER_LABEL: Record<string, string> = {
  male:   'M',
  female: 'W',
  other:  'D',
};

const STATUS_LABEL: Record<SparringSignupStatus, string> = {
  pending:        'zugesagt',
  confirmed:      'bestätigt',
  waitlisted:     'Warteliste',
  attended:       'erschienen',
  no_show:        'nicht erschienen',
  cancelled:      'abgesagt',
  cancelled_late: 'abgesagt',
  expired:        'verfallen',
};

// Statuses the organizer may still correct once the sparring has started.
const ATTENDANCE_EDITABLE: ReadonlySet<SparringSignupStatus> = new Set(['confirmed', 'attended', 'no_show']);

interface Props {
  sparringId:          string;
  currentUserId:       string | null;
  sparringScheduledAt: string;
  isOrganizer:         boolean;
  /** Loaded once by the detail window (shared with the summary above). */
  participants:        SparringParticipant[];
  loading:             boolean;
  /** Called after attendance was recorded, so the window reloads the list. */
  onAttendanceChanged: () => void;
  onPressProfile:      (userId: string) => void;
}

function statusLabel(p: SparringParticipant): string {
  if (p.status === 'waitlisted' && p.waitlist_position !== null) {
    return `Warteliste ${p.waitlist_position}`;
  }
  return STATUS_LABEL[p.status] ?? p.status;
}

export default function SparringParticipantsList({
  sparringId,
  currentUserId,
  sparringScheduledAt,
  isOrganizer,
  participants,
  loading,
  onAttendanceChanged,
  onPressProfile,
}: Props): React.ReactElement | null {
  const { markAttendance } = useSparringActions();
  const [markingUserId, setMarkingUserId] = useState<string | null>(null);

  const showAttendanceToggle = isOrganizer && hasStarted(sparringScheduledAt, new Date());

  async function handleMarkAttendance(userId: string, present: boolean): Promise<void> {
    setMarkingUserId(userId);
    const { error } = await markAttendance(sparringId, userId, present);
    setMarkingUserId(null);
    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }
    onAttendanceChanged();
  }

  // Spinner only on the first load; a background reload keeps the rows.
  if (loading && participants.length === 0) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={colors.accentBlue} />
      </View>
    );
  }

  const visible = participants.filter((p) => p.user_id !== currentUserId);
  if (visible.length === 0) return null;

  return (
    // Rendered expanded below SparringParticipantsSummary (which is the heading).
    <View style={styles.container}>
      {visible.map((p) => (
        <View key={p.user_id} style={styles.row}>
          <TouchableOpacity
            style={styles.rowMain}
            activeOpacity={0.7}
            onPress={() => { onPressProfile(p.user_id); }}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsOf(p.name)}</Text>
            </View>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{p.name ?? 'Unbekannt'}</Text>
              {p.gender !== null && GENDER_LABEL[p.gender] !== undefined && (
                <View style={styles.genderBadge}>
                  <Text style={styles.genderBadgeText}>{GENDER_LABEL[p.gender]}</Text>
                </View>
              )}
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{statusLabel(p)}</Text>
              </View>
            </View>
          </TouchableOpacity>

          {showAttendanceToggle && ATTENDANCE_EDITABLE.has(p.status) && (
            <View style={styles.attendanceRow}>
              <TouchableOpacity
                style={[styles.attendanceBtn, p.status === 'attended' && styles.attendanceBtnPresent]}
                onPress={() => { void handleMarkAttendance(p.user_id, true); }}
                disabled={markingUserId === p.user_id}
              >
                <Text style={[styles.attendanceBtnText, p.status === 'attended' && styles.attendanceBtnTextPresent]}>
                  Erschienen
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.attendanceBtn, p.status === 'no_show' && styles.attendanceBtnAbsent]}
                onPress={() => { void handleMarkAttendance(p.user_id, false); }}
                disabled={markingUserId === p.user_id}
              >
                <Text style={[styles.attendanceBtnText, p.status === 'no_show' && styles.attendanceBtnTextAbsent]}>
                  Nicht erschienen
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  container: {
    gap: 8,
  },
  row: {
    gap: 8,
    paddingVertical: 8,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
  },
  avatar: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.accentBlueSoft,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlue,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    flex:          1,
    flexWrap:      'wrap',
  },
  name: {
    fontSize:   15,
    fontWeight: '500',
    color:      colors.text,
  },
  genderBadge: {
    backgroundColor:   colors.accentBlueSoft,
    borderRadius:      6,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  genderBadgeText: {
    fontSize:   11,
    fontWeight: '700',
    color:      colors.accentBlue,
  },
  statusBadge: {
    backgroundColor:   colors.background,
    borderRadius:      6,
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  statusBadgeText: {
    fontSize:   11,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
  attendanceRow: {
    flexDirection: 'row',
    gap:           8,
    marginLeft:    56, // aligns under the name, past the avatar
  },
  attendanceBtn: {
    borderRadius:      8,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  attendanceBtnPresent: {
    borderColor:     colors.difficultyGreen,
    backgroundColor: colors.difficultyGreenSoft,
  },
  attendanceBtnAbsent: {
    borderColor:     colors.deleteRed,
    backgroundColor: colors.deleteRedSoft,
  },
  attendanceBtnText: {
    fontSize:   12,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
  attendanceBtnTextPresent: {
    color: colors.difficultyGreen,
  },
  attendanceBtnTextAbsent: {
    color: colors.deleteRed,
  },
});
