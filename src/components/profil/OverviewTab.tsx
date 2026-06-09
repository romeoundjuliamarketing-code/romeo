import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { Profile } from '../../types/database.types';
import type { Studio } from '../../hooks/useStudio';
import TeamPickerCard from './TeamPickerCard';
import type { VerificationTier } from '../../utils/verificationTier';

interface OverviewTabProps {
  profile: Profile | null;
  tier: VerificationTier;
  currentStudio: Studio | null;
  focusTrigger: number;
  canCreateStudio: boolean;
  onJoinStudio: (studioId: string) => Promise<void>;
  onSearchStudios: (query: string) => Promise<Studio[]>;
  onCreateStudio: (name: string, city: string) => Promise<Studio | null>;
  onRedeemCode: (code: string) => Promise<{ error: string | null }>;
  onViewTeam: (() => void) | undefined;
  onOpenVerification: () => void;
}

function SteckbriefRow({ icon, label, value }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.steckbriefRow}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.textSecondary} />
      <Text style={styles.steckbriefLabel}>{label}</Text>
      <Text style={styles.steckbriefValue}>{value}</Text>
    </View>
  );
}

export default function OverviewTab({
  profile,
  tier,
  currentStudio,
  focusTrigger,
  canCreateStudio,
  onJoinStudio,
  onSearchStudios,
  onCreateStudio,
  onRedeemCode,
  onViewTeam,
  onOpenVerification,
}: OverviewTabProps): React.ReactElement {
  // Build steckbrief rows (only show fields that have values)
  const steckbriefRows: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string }[] = [];

  if (profile?.weight_class !== null && profile?.weight_class !== undefined && profile.weight_class.length > 0) {
    steckbriefRows.push({ icon: 'trophy-outline', label: 'Gewichtsklasse', value: profile.weight_class });
  }
  if (profile?.weight_kg !== null && profile?.weight_kg !== undefined) {
    steckbriefRows.push({ icon: 'weight-kilogram', label: 'Kampfgewicht', value: `${profile.weight_kg} kg` });
  }
  if (profile?.height_cm !== null && profile?.height_cm !== undefined) {
    steckbriefRows.push({ icon: 'human-male-height', label: 'Körpergrösse', value: `${profile.height_cm} cm` });
  }
  if (profile?.arm_span_cm !== null && profile?.arm_span_cm !== undefined) {
    steckbriefRows.push({ icon: 'arrow-left-right', label: 'Spannweite', value: `${profile.arm_span_cm} cm` });
  }
  if (profile?.age_years !== null && profile?.age_years !== undefined) {
    steckbriefRows.push({ icon: 'calendar-account-outline', label: 'Alter', value: `${profile.age_years} Jahre` });
  }
  if (profile?.nationality !== null && profile?.nationality !== undefined && profile.nationality.length > 0) {
    steckbriefRows.push({ icon: 'flag-outline', label: 'Nationalität', value: profile.nationality });
  }
  if (profile?.hometown !== null && profile?.hometown !== undefined && profile.hometown.length > 0) {
    steckbriefRows.push({ icon: 'map-marker-outline', label: 'Heimatstadt', value: profile.hometown });
  }
  if (profile?.stance !== null && profile?.stance !== undefined) {
    steckbriefRows.push({ icon: 'boxing-glove', label: 'Auslage', value: profile.stance === 'orthodox' ? 'Rechtshänder' : 'Linkshänder' });
  }

  return (
    <View style={styles.container}>
      {/* Bio block */}
      {profile?.bio !== null && profile?.bio !== undefined && profile.bio.length > 0 && (
        <View style={styles.bioCard}>
          <Text style={styles.bioText}>{profile.bio}</Text>
        </View>
      )}

      {/* Team card */}
      <View style={styles.card}>
        <TeamPickerCard
          currentStudio={currentStudio}
          onJoin={onJoinStudio}
          onSearch={onSearchStudios}
          onRedeemCode={onRedeemCode}
          onCreate={async (name, city) => {
            if (!canCreateStudio) {
              Alert.alert('Studio-Abo erforderlich', 'Ein neues Team kann nur mit einem aktiven Studio-Abo erstellt werden.');
              return null;
            }
            const created = await onCreateStudio(name, city);
            if (created === null) {
              Alert.alert('Fehler', 'Studio konnte nicht erstellt werden.');
            }
            return created;
          }}
          canCreateStudio={canCreateStudio}
          onCreateBlocked={() => {
            Alert.alert('Studio-Abo erforderlich', 'Ein neues Team kann nur mit einem aktiven Studio-Abo erstellt werden.');
          }}
          onViewTeam={onViewTeam}
          inline
        />
      </View>

      {/* Steckbrief */}
      {steckbriefRows.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Steckbrief</Text>
          {steckbriefRows.map((row) => (
            <SteckbriefRow
              key={row.label}
              icon={row.icon}
              label={row.label}
              value={row.value}
            />
          ))}
        </View>
      )}

      {/* Disciplines as chips */}
      {profile?.disciplines !== null && profile?.disciplines !== undefined && profile.disciplines.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Disziplinen</Text>
          <View style={styles.chipsRow}>
            {profile.disciplines.map((d) => (
              <View key={d} style={styles.chip}>
                <Text style={styles.chipText}>{d}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Verification row — only if NOT verified */}
      {tier !== 'verified' && (
        <TouchableOpacity
          style={styles.verificationRow}
          onPress={onOpenVerification}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="shield-check-outline" size={24} color={colors.accentBlue} />
          <View style={styles.verificationRowContent}>
            <Text style={styles.verificationRowTitle}>Verifizierung</Text>
            <Text style={styles.verificationRowStatus}>
              {tier === 'basic' ? 'Fast geschafft – ein Nachweis fehlt' : 'Nicht verifiziert'}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  android: { elevation: 1 },
});

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingBottom: 32,
  },
  bioCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    ...cardShadow,
  },
  bioText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    ...cardShadow,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Steckbrief
  steckbriefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  steckbriefLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  steckbriefValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  // Disciplines
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  verificationRow: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...cardShadow,
  },
  verificationRowContent: {
    flex: 1,
    gap: 4,
  },
  verificationRowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  verificationRowStatus: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
