import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, ActivityIndicator,
} from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useBlockedUsers, type BlockedUser } from '../hooks/useBlockedUsers';

const AVATAR = 40;

export default function BlockedUsersScreen(): React.ReactElement {
  const navigation = useNavigation();
  const { blocked, loading, unblock } = useBlockedUsers();

  const confirmUnblock = useCallback((u: BlockedUser) => {
    Alert.alert(
      'Blockierung aufheben?',
      `Du siehst die Chat-Nachrichten von ${u.name ?? 'dieser Person'} wieder.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Aufheben',
          onPress: () => {
            void unblock(u.id).then(({ error }) => {
              if (error !== null) Alert.alert('Fehler', 'Die Blockierung konnte nicht aufgehoben werden. Bitte versuche es erneut.');
            });
          },
        },
      ],
    );
  }, [unblock]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<BlockedUser>) => (
    <View style={styles.row}>
      {item.avatarUrl !== null
        ? <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
        : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <MaterialCommunityIcons name="account" size={24} color={colors.inactive} />
          </View>
        )}
      <Text style={styles.name} numberOfLines={1}>{item.name ?? 'Unbekannt'}</Text>
      <TouchableOpacity
        style={styles.unblockBtn}
        onPress={() => confirmUnblock(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Blockierung von ${item.name ?? 'Nutzer'} aufheben`}
      >
        <Text style={styles.unblockText}>Aufheben</Text>
      </TouchableOpacity>
    </View>
  ), [confirmUnblock]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blockierte Nutzer</Text>
        <View style={styles.backBtn} />
      </View>

      {loading && blocked.length === 0
        ? <ActivityIndicator color={colors.accentBlue} style={styles.spinner} />
        : (
          <FlatList
            data={blocked}
            keyExtractor={(u) => u.id}
            renderItem={renderItem}
            contentContainerStyle={styles.content}
            ItemSeparatorComponent={Separator}
            ListHeaderComponent={
              <Text style={styles.hint}>
                Von blockierten Personen siehst du keine Chat-Nachrichten mehr. Sie werden darüber nicht benachrichtigt.
              </Text>
            }
            ListEmptyComponent={<Text style={styles.empty}>Du hast niemanden blockiert.</Text>}
          />
        )}
    </SafeAreaView>
  );
}

function Separator(): React.ReactElement {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  backBtn: { width: 36, alignItems: 'center' },
  spinner: { marginTop: 32 },
  content: { padding: 16 },
  hint: { fontSize: 14, lineHeight: 20, color: colors.textMuted, marginBottom: 16 },
  empty: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  avatarEmpty: { backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },
  unblockBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unblockText: { fontSize: 14, fontWeight: '600', color: colors.accentBlue },
  divider: { height: 1, backgroundColor: colors.border },
});
