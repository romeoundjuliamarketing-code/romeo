import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { useGym } from '../hooks/useGyms';
import { useGymEdit } from '../hooks/useGymEdit';
import type { GymDraft } from '../hooks/useGymEdit';
import { useBannedWords } from '../hooks/useBannedWords';
import { checkText, filterErrorMessage } from '../utils/contentFilter';
import { GYM_LIMITS, validateNewGym } from '../utils/gymSearch';
import { normalizeWebsite, WEBSITE_MAX } from '../utils/gymLinks';
import LabeledInput from '../components/common/LabeledInput';
import { RetryNotice } from '../components/common/TextAction';
import { PrimaryButton } from '../components/profil/ProfileParts';
import { DisciplineSelector } from '../components/profil/edit/SportSelectors';
import GymImageFields from '../components/gym/GymImageFields';

type Nav = NativeStackNavigationProp<RootStackParamList, 'GymEdit'>;
type Route = RouteProp<RootStackParamList, 'GymEdit'>;
type Errors = Partial<Record<'name' | 'city' | 'address' | 'description' | 'website' | 'form', string>>;

const DESCRIPTION_MAX = 300;

// "Gym bearbeiten" for the operator: only the facts of the reduced gym page.
// No schedule, prices, roles or members — those are gone from the gym page.
export default function GymEditScreen(): React.ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { gymId } = useRoute<Route>().params;
  const { user } = useAuth();
  const { gym, status, refetch } = useGym(gymId);
  const { saving, save } = useGymEdit(gym);
  const { bannedWords } = useBannedWords();

  const [draft, setDraft] = useState<(Omit<GymDraft, 'websiteUrl'> & { website: string }) | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const dirty = useRef(false);

  // The draft starts once from the loaded gym; later reloads never overwrite typing.
  useEffect(() => {
    if (gym === null || draft !== null) return;
    setDraft({
      name: gym.name, city: gym.city, address: gym.address ?? '', disciplines: gym.disciplines,
      description: gym.description ?? '', website: gym.website_url ?? '', coverUri: null, logoUri: null,
    });
  }, [gym, draft]);

  // Unsaved changes: ask before leaving (back button, swipe, Android back).
  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (!dirty.current) return;
    e.preventDefault();
    Alert.alert(t('gym.edit.discardTitle'), t('gym.edit.discardBody'), [
      { text: t('gym.edit.keepEditing'), style: 'cancel' },
      { text: t('gym.edit.discard'), style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
    ]);
  }), [navigation, t]);

  function change(patch: Partial<NonNullable<typeof draft>>): void {
    dirty.current = true;
    setDraft((d) => (d === null ? d : { ...d, ...patch }));
  }

  async function submit(): Promise<void> {
    if (draft === null) return;
    const next: Errors = { ...validateNewGym(draft) };
    const website = normalizeWebsite(draft.website);
    if (website.error !== null) next.website = website.error;
    for (const field of ['name', 'city', 'description'] as const) {
      const verdict = checkText(draft[field], bannedWords);
      if (!verdict.ok && next[field] === undefined) next[field] = filterErrorMessage(verdict.category);
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const { error } = await save({ ...draft, websiteUrl: website.url });
    if (error !== null) {
      setErrors({ form: error });
      return;
    }
    dirty.current = false;
    navigation.goBack();
  }

  const isOwner = gym !== null && user !== null && gym.owner_user_id === user.id;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} accessibilityRole="header">{t('gym.menu.edit')}</Text>
      </View>

      {gym === null || draft === null ? (
        <View style={styles.state}>
          {status === 'error'
            ? <RetryNotice message={t('gym.pageState.loadError')} onRetry={refetch} />
            : <ActivityIndicator color={colors.accentBlue} />}
        </View>
      ) : !isOwner ? (
        <View style={styles.state}>
          <Text style={styles.muted}>{t('gym.edit.ownersOnly')}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <LabeledInput label={t('gym.correction.name')} value={draft.name} onChange={(v) => change({ name: v })} max={GYM_LIMITS.name} error={errors.name} />
            <LabeledInput label={t('gym.correction.city')} value={draft.city} onChange={(v) => change({ city: v })} max={GYM_LIMITS.city} error={errors.city} />
            <LabeledInput label={t('gym.picker.fieldAddress')} value={draft.address} onChange={(v) => change({ address: v })} max={GYM_LIMITS.address} error={errors.address} placeholder={t('gym.edit.addressPlaceholder')} />
            <DisciplineSelector selected={draft.disciplines} onChange={(d) => change({ disciplines: d })} />
            <LabeledInput label={t('gym.edit.description')} value={draft.description} onChange={(v) => change({ description: v })} max={DESCRIPTION_MAX} error={errors.description} multiline />
            <LabeledInput
              label={t('gym.edit.website')} value={draft.website} onChange={(v) => change({ website: v })} max={WEBSITE_MAX}
              error={errors.website} keyboardType="url" autoCapitalize="none" placeholder="boxclub.de"
            />
            <GymImageFields
              name={draft.name}
              coverUri={draft.coverUri ?? gym.banner_url}
              logoUri={draft.logoUri ?? gym.avatar_url}
              onCover={(uri) => change({ coverUri: uri })}
              onLogo={(uri) => change({ logoUri: uri })}
            />
            {errors.form !== undefined && <Text style={styles.error}>{errors.form}</Text>}
            <PrimaryButton icon="checkmark" label={t('common.save')} loading={saving} onPress={() => { void submit(); }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  toolbar: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 8,
    minHeight:         56,
  },
  iconBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  title: {
    fontSize:   18,
    fontWeight: '800',
    color:      colors.text,
  },
  state: {
    flex:    1,
    padding: 16,
  },
  muted: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.textMuted,
  },
  form: {
    width:             '100%',
    maxWidth:          600,
    alignSelf:         'center',
    paddingHorizontal: 16,
    paddingTop:        8,
    paddingBottom:     48,
    gap:               24,
  },
  error: {
    fontSize: 14,
    color:    colors.deleteRed,
  },
});
