import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusRefetch } from '../hooks/useFocusRefetch';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import { useProfile } from '../hooks/useProfile';
import { getInitials } from '../components/profil/ProfileHero';
import AvatarPicker from '../components/profil/AvatarPicker';
import ProfileDetailsForm from '../components/profil/ProfileDetailsForm';

export default function EditProfileScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [focusTrigger, setFocusTrigger] = useState(0);
  useFocusRefetch(() => setFocusTrigger((n) => n + 1));

  const { profile, uploadAvatar, updateProfile } = useProfile(focusTrigger);

  const initials = getInitials(profile?.name ?? null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil bearbeiten</Text>
        {/* Spacer to center title */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar picker */}
        <View style={styles.avatarSection}>
          <AvatarPicker
            avatarUrl={profile?.avatar_url ?? null}
            initials={initials}
            onUpload={uploadAvatar}
          />
          <Text style={styles.avatarHint}>Tippen zum Ändern</Text>
        </View>

        {/* Profile form */}
        <ProfileDetailsForm
          profile={profile}
          updateProfile={updateProfile}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerSpacer: {
    width: 24,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 48,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  avatarHint: {
    fontSize: 12,
    color: colors.inactive,
  },
});
