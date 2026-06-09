# Fighter Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Erweitere Kämpferprofile um kampfsport-relevante Felder, gestalte PublicProfileScreen um und füge Profil-Code-Sharing hinzu, damit Sparringspartner wissen mit wem sie es zu tun haben.

**Architecture:** Zwei DB-Migrationen ergänzen neue Spalten in `profiles` und `fight_records`. Eine neue `FighterProfileCard` nutzt `useProfile.updateProfile` für Edits. `PublicProfileScreen` erweitert seinen Fetch um alle neuen Felder und zeigt sie strukturiert (Hero, Stats, Bio, Record, Info, Social). `FightRecordCard` bekommt einen Amateur/Profi-Tab. QR-Code-Share läuft über `react-native-qrcode-svg` + RN `Share` API.

**Tech Stack:** React Native, Expo SDK 55, Supabase, react-native-qrcode-svg (react-native-svg 15.15.3 bereits installiert)

---

## File Map

**Neu erstellt:**
- `supabase/migrations/20260608100000_add_fighter_profile_fields.sql`
- `supabase/migrations/20260608100001_add_fight_record_amateur.sql`
- `src/components/profil/FighterProfileCard.tsx`

**Geändert:**
- `src/types/database.types.ts` — neue Spalten in Row/Insert/Update für `profiles` und `fight_records`
- `src/navigation/types.ts` — `sparringId` / `sparringScheduledAt` optional machen
- `src/screens/PublicProfileScreen.tsx` — erweiterter Fetch + neue Sektionen + QR Share
- `src/screens/ProfilScreen.tsx` — FighterProfileCard + Profil-Code-Suche
- `src/components/profil/FightRecordCard.tsx` — Amateur/Profi-Tab
- `src/components/profil/AddFightSheet.tsx` — `is_amateur` Toggle

---

### Task 1: Migration — neue Profilfelder

**Files:**
- Create: `supabase/migrations/20260608100000_add_fighter_profile_fields.sql`

- [ ] **Schritt 1: SQL-Datei anlegen**

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname      text,
  ADD COLUMN IF NOT EXISTS weight_class  text,
  ADD COLUMN IF NOT EXISTS weight_kg     numeric(5,2),
  ADD COLUMN IF NOT EXISTS nationality   text,
  ADD COLUMN IF NOT EXISTS hometown      text,
  ADD COLUMN IF NOT EXISTS bio           text CHECK (char_length(bio) <= 300),
  ADD COLUMN IF NOT EXISTS instagram_url text;
```

- [ ] **Schritt 2: Migration auf Remote anwenden**

Via Supabase MCP: `apply_migration` mit dem obigen SQL und `name: '20260608100000_add_fighter_profile_fields'`.

- [ ] **Schritt 3: Verifizieren**

Via Supabase MCP: `list_tables` → `profiles` Row in der Ausgabe auf die neuen Spalten prüfen.

---

### Task 2: Migration — is_amateur in fight_records

**Files:**
- Create: `supabase/migrations/20260608100001_add_fight_record_amateur.sql`

- [ ] **Schritt 1: SQL-Datei anlegen**

```sql
ALTER TABLE public.fight_records
  ADD COLUMN IF NOT EXISTS is_amateur boolean NOT NULL DEFAULT false;
```

- [ ] **Schritt 2: Migration auf Remote anwenden**

Via Supabase MCP: `apply_migration` mit dem obigen SQL und `name: '20260608100001_add_fight_record_amateur'`.

- [ ] **Schritt 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(fighter-profile): add migrations for new profile fields and is_amateur"
```

---

### Task 3: TypeScript-Typen aktualisieren

**Files:**
- Modify: `src/types/database.types.ts`
- Modify: `src/navigation/types.ts`

- [ ] **Schritt 1: Neue Spalten in `profiles` Row hinzufügen**

In `database.types.ts`, im Block `profiles: { Row: { ... } }` nach `instagram_url` (alphabetisch sortiert einpflegen):

```typescript
// In profiles.Row — neue Felder ergänzen:
bio:            string | null
hometown:       string | null
instagram_url:  string | null
nationality:    string | null
nickname:       string | null
weight_class:   string | null
weight_kg:      number | null
```

- [ ] **Schritt 2: Gleiche Felder in profiles.Insert ergänzen**

Im Block `profiles: { Insert: { ... } }`:

```typescript
bio?:            string | null
hometown?:       string | null
instagram_url?:  string | null
nationality?:    string | null
nickname?:       string | null
weight_class?:   string | null
weight_kg?:      number | null
```

- [ ] **Schritt 3: Gleiche Felder in profiles.Update ergänzen**

Im Block `profiles: { Update: { ... } }` — exakt identisch wie Insert (alle mit `?`).

- [ ] **Schritt 4: is_amateur in fight_records ergänzen**

Im Block `fight_records: { Row: { ... } }`:
```typescript
is_amateur: boolean
```

Im Block `fight_records: { Insert: { ... } }`:
```typescript
is_amateur?: boolean
```

Im Block `fight_records: { Update: { ... } }`:
```typescript
is_amateur?: boolean
```

- [ ] **Schritt 5: PublicProfile-Route optional machen**

In `src/navigation/types.ts`, den Block `PublicProfile` ändern:

```typescript
PublicProfile: {
  userId:               string;
  sparringId?:          string;
  sparringScheduledAt?: string;
};
```

- [ ] **Schritt 6: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: keine neuen Fehler. Falls `sparringId`/`sparringScheduledAt` an Stellen nicht-optional übergeben werden, ist das OK — optionale Params sind abwärtskompatibel.

- [ ] **Schritt 7: Commit**

```bash
git add src/types/database.types.ts src/navigation/types.ts
git commit -m "feat(fighter-profile): update types for new profile fields and optional sparring params"
```

---

### Task 4: FighterProfileCard — neue editierbare Card

**Files:**
- Create: `src/components/profil/FighterProfileCard.tsx`

- [ ] **Schritt 1: Datei erstellen**

```tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { colors } from '../../theme/colors';
import type { Profile, ProfileUpdate } from '../../types/database.types';

const WEIGHT_CLASSES = [
  'Strawweight',
  'Flyweight',
  'Bantamweight',
  'Featherweight',
  'Lightweight',
  'Welterweight',
  'Middleweight',
  'Light Heavyweight',
  'Heavyweight',
  'Super Heavyweight',
] as const;

interface FighterProfileCardProps {
  profile:       Profile | null;
  updateProfile: (updates: ProfileUpdate) => Promise<void>;
}

export default function FighterProfileCard({
  profile,
  updateProfile,
}: FighterProfileCardProps): React.ReactElement {
  const [nickname,     setNickname]     = useState(profile?.nickname      ?? '');
  const [weightClass,  setWeightClass]  = useState(profile?.weight_class  ?? '');
  const [weightKg,     setWeightKg]     = useState(
    profile?.weight_kg !== null && profile?.weight_kg !== undefined
      ? String(profile.weight_kg)
      : '',
  );
  const [nationality,  setNationality]  = useState(profile?.nationality   ?? '');
  const [hometown,     setHometown]     = useState(profile?.hometown       ?? '');
  const [bio,          setBio]          = useState(profile?.bio            ?? '');
  const [instagramUrl, setInstagramUrl] = useState(profile?.instagram_url  ?? '');
  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [saving,       setSaving]       = useState(false);

  async function handleSave(): Promise<void> {
    setSaving(true);
    await updateProfile({
      nickname:      nickname.trim().length     > 0 ? nickname.trim()                         : null,
      weight_class:  weightClass.length         > 0 ? weightClass                             : null,
      weight_kg:     weightKg.trim().length     > 0 ? parseFloat(weightKg.replace(',', '.'))  : null,
      nationality:   nationality.trim().length  > 0 ? nationality.trim()                      : null,
      hometown:      hometown.trim().length     > 0 ? hometown.trim()                         : null,
      bio:           bio.trim().length          > 0 ? bio.trim().slice(0, 300)                : null,
      instagram_url: instagramUrl.trim().length > 0 ? instagramUrl.trim()                     : null,
    });
    setSaving(false);
    Alert.alert('Gespeichert', 'Kämpferprofil wurde aktualisiert.');
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Kämpferprofil</Text>

      <Text style={styles.label}>Kampfname</Text>
      <TextInput
        style={styles.input}
        value={nickname}
        onChangeText={setNickname}
        placeholder='z.B. "The Hammer"'
        placeholderTextColor={colors.textSecondary}
        maxLength={50}
      />

      <Text style={styles.label}>Gewichtsklasse</Text>
      <TouchableOpacity
        style={styles.pickerBtn}
        onPress={() => setPickerOpen((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={[styles.pickerBtnText, weightClass.length === 0 && styles.placeholder]}>
          {weightClass.length > 0 ? weightClass : 'Auswählen...'}
        </Text>
      </TouchableOpacity>
      {pickerOpen && (
        <View style={styles.pickerList}>
          {WEIGHT_CLASSES.map((wc) => (
            <TouchableOpacity
              key={wc}
              style={[styles.pickerItem, weightClass === wc && styles.pickerItemActive]}
              onPress={() => { setWeightClass(wc); setPickerOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerItemText, weightClass === wc && styles.pickerItemTextActive]}>
                {wc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.label}>Kampfgewicht (kg)</Text>
      <TextInput
        style={styles.input}
        value={weightKg}
        onChangeText={setWeightKg}
        placeholder="z.B. 70"
        placeholderTextColor={colors.textSecondary}
        keyboardType="decimal-pad"
        maxLength={6}
      />

      <Text style={styles.label}>Nationalität</Text>
      <TextInput
        style={styles.input}
        value={nationality}
        onChangeText={setNationality}
        placeholder="z.B. Deutsch"
        placeholderTextColor={colors.textSecondary}
        maxLength={50}
      />

      <Text style={styles.label}>Heimatstadt</Text>
      <TextInput
        style={styles.input}
        value={hometown}
        onChangeText={setHometown}
        placeholder="z.B. München"
        placeholderTextColor={colors.textSecondary}
        maxLength={100}
      />

      <Text style={styles.label}>Über mich</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={bio}
        onChangeText={(t) => setBio(t.slice(0, 300))}
        placeholder="Kurze Vorstellung, Kampfstil, Ziele..."
        placeholderTextColor={colors.textSecondary}
        multiline
        maxLength={300}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{bio.length}/300</Text>

      <Text style={styles.label}>Instagram-Link</Text>
      <TextInput
        style={styles.input}
        value={instagramUrl}
        onChangeText={setInstagramUrl}
        placeholder="https://instagram.com/username"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        keyboardType="url"
        maxLength={200}
      />

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={() => { void handleSave(); }}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving
          ? <ActivityIndicator color={colors.card} />
          : <Text style={styles.saveBtnText}>Speichern</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius:    16,
    padding:         16,
    gap:             8,
  },
  title: {
    fontSize:     15,
    fontWeight:   '700',
    color:        colors.text,
    marginBottom: 8,
  },
  label: {
    fontSize:   12,
    fontWeight: '600',
    color:      colors.textSecondary,
    marginTop:  8,
  },
  input: {
    backgroundColor:   colors.background,
    borderRadius:      10,
    paddingHorizontal: 12,
    paddingVertical:   10,
    fontSize:          14,
    color:             colors.text,
  },
  bioInput: {
    minHeight: 80,
  },
  charCount: {
    fontSize:  11,
    color:     colors.textSecondary,
    textAlign: 'right',
    marginTop: -4,
  },
  placeholder: {
    color: colors.textSecondary,
  },
  pickerBtn: {
    backgroundColor:   colors.background,
    borderRadius:      10,
    paddingHorizontal: 12,
    paddingVertical:   10,
  },
  pickerBtnText: {
    fontSize: 14,
    color:    colors.text,
  },
  pickerList: {
    backgroundColor: colors.background,
    borderRadius:    10,
    overflow:        'hidden',
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical:   10,
  },
  pickerItemActive: {
    backgroundColor: colors.accentBlueSoft,
  },
  pickerItemText: {
    fontSize: 14,
    color:    colors.text,
  },
  pickerItemTextActive: {
    color:      colors.accentBlue,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius:    12,
    height:          48,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       8,
  },
  saveBtnDisabled: {
    backgroundColor: colors.accentBlueMuted,
  },
  saveBtnText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.card,
  },
});
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: keine Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add src/components/profil/FighterProfileCard.tsx
git commit -m "feat(fighter-profile): add FighterProfileCard editable component"
```

---

### Task 5: AddFightSheet — is_amateur Toggle

**Files:**
- Modify: `src/components/profil/AddFightSheet.tsx`

- [ ] **Schritt 1: Props-Typ um is_amateur erweitern**

`AddFightSheetProps.addFight`-Parameter-Typ um `is_amateur: boolean` ergänzen:

```typescript
addFight: (data: {
  result:        ResultType;
  method:        MethodType | null;
  opponent_name: string | null;
  organization:  string | null;
  fight_date:    string | null;
  is_amateur:    boolean;
}) => Promise<{ error: string | null }>;
```

- [ ] **Schritt 2: State hinzufügen**

Nach `const [saving, setSaving] = useState(false);`:

```typescript
const [isAmateur, setIsAmateur] = useState(false);
```

- [ ] **Schritt 3: Reset in handleClose**

In `handleClose` nach `setDateStr('')`:

```typescript
setIsAmateur(false);
```

- [ ] **Schritt 4: is_amateur in handleSave übergeben**

Im `addFight({...})`-Aufruf ergänzen:

```typescript
is_amateur: isAmateur,
```

- [ ] **Schritt 5: Toggle-UI vor dem Speichern-Button einfügen**

Nach dem Datum-TextInput, vor dem `saveBtn`-TouchableOpacity:

```tsx
<Text style={styles.fieldLabel}>Typ</Text>
<View style={styles.chipRow}>
  <TouchableOpacity
    style={[styles.chip, !isAmateur && styles.chipActive]}
    onPress={() => setIsAmateur(false)}
    activeOpacity={0.7}
  >
    <Text style={[styles.chipText, !isAmateur && styles.chipTextActive]}>Profi</Text>
  </TouchableOpacity>
  <TouchableOpacity
    style={[styles.chip, isAmateur && styles.chipActive]}
    onPress={() => setIsAmateur(true)}
    activeOpacity={0.7}
  >
    <Text style={[styles.chipText, isAmateur && styles.chipTextActive]}>Amateur</Text>
  </TouchableOpacity>
</View>
```

- [ ] **Schritt 6: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Falls `ProfilScreen` `addFight` aus `useFightRecord` an `AddFightSheet` übergibt: `useFightRecord.addFight` nimmt `FightInsert` = `Omit<FightRecordInsert, 'user_id'>`. Nach Task 3 enthält `FightRecordInsert` bereits `is_amateur?: boolean`. Da der Parameter optional ist, passt der Typ — kein Fehler erwartet.

- [ ] **Schritt 7: Commit**

```bash
git add src/components/profil/AddFightSheet.tsx
git commit -m "feat(fighter-profile): add is_amateur toggle to AddFightSheet"
```

---

### Task 6: FightRecordCard — Amateur/Profi-Tab

**Files:**
- Modify: `src/components/profil/FightRecordCard.tsx`

- [ ] **Schritt 1: Tab-State und gefilterte Fights**

Import `useState` (bereits da) nutzen. Nach dem Props-Destructuring am Anfang der Komponente:

```typescript
const hasAmateur = fights.some((f) => f.is_amateur === true);
const hasPro     = fights.some((f) => f.is_amateur !== true);
const showTabs   = hasAmateur && hasPro;

const [activeTab, setActiveTab] = useState<'pro' | 'amateur'>('pro');

const visibleFights = showTabs
  ? fights.filter((f) => activeTab === 'amateur' ? f.is_amateur === true : f.is_amateur !== true)
  : fights;
```

- [ ] **Schritt 2: Tab-UI nach dem Header einfügen**

Direkt nach `</View>` (dem `header`-View) und vor der `summaryRow`:

```tsx
{showTabs && (
  <View style={styles.tabRow}>
    {(['pro', 'amateur'] as const).map((tab) => (
      <TouchableOpacity
        key={tab}
        style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
        onPress={() => setActiveTab(tab)}
        activeOpacity={0.7}
      >
        <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
          {tab === 'pro' ? 'Profi' : 'Amateur'}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
)}
```

- [ ] **Schritt 3: `fights` durch `visibleFights` ersetzen**

In der `summaryRow` und in der `fights.map(...)` alle Referenzen auf `fights` durch `visibleFights` ersetzen:

```typescript
// summaryRow — statt fights.filter(...):
const wins   = visibleFights.filter((f) => f.result === 'win').length;
const losses = visibleFights.filter((f) => f.result === 'loss').length;
const draws  = visibleFights.filter((f) => f.result === 'draw').length;
const kos    = visibleFights.filter((f) => f.method === 'ko' || f.method === 'tko').length;
```

Und in der Map: `visibleFights.map((fight, index) => { ... })`.

Außerdem leerer Zustand: `visibleFights.length === 0` statt `fights.length === 0`.

- [ ] **Schritt 4: Styles ergänzen**

```typescript
tabRow: {
  flexDirection:  'row',
  gap:            8,
  marginBottom:   12,
},
tabBtn: {
  flex:              1,
  height:            32,
  borderRadius:      8,
  borderWidth:       1,
  borderColor:       colors.border,
  alignItems:        'center',
  justifyContent:    'center',
},
tabBtnActive: {
  backgroundColor: colors.accentBlue,
  borderColor:     colors.accentBlue,
},
tabBtnText: {
  fontSize:   13,
  fontWeight: '600',
  color:      colors.text,
},
tabBtnTextActive: {
  color: '#FFFFFF',
},
```

- [ ] **Schritt 5: TouchableOpacity importieren** (falls noch nicht importiert)

```typescript
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
```

TouchableOpacity ist bereits im Import — kein Änderungsbedarf.

- [ ] **Schritt 6: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: keine Fehler. `f.is_amateur` ist nach Task 3 `boolean` auf `FightRecord`.

- [ ] **Schritt 7: Commit**

```bash
git add src/components/profil/FightRecordCard.tsx
git commit -m "feat(fighter-profile): add pro/amateur tab toggle to FightRecordCard"
```

---

### Task 7: PublicProfileScreen — Redesign

**Files:**
- Modify: `src/screens/PublicProfileScreen.tsx`

- [ ] **Schritt 1: Image + Share + Linking importieren**

Bestehende Imports erweitern:

```typescript
import { Image, Linking, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
```

Falls `react-native-qrcode-svg` nicht installiert:
```bash
npm install react-native-qrcode-svg
```
(Kein nativer Rebuild nötig — nutzt das bereits installierte `react-native-svg`.)

- [ ] **Schritt 2: PublicProfile-Interface erweitern**

Das bestehende `interface PublicProfile { ... }` ersetzen durch:

```typescript
interface PublicProfile {
  name:              string | null;
  age_years:         number | null;
  avatar_url:        string | null;
  gender:            string | null;
  disciplines:       string[];
  show_fight_record: boolean;
  show_stats:        boolean;
  coach_verified_at: string | null;
  studio_id:         string | null;
  nickname:          string | null;
  weight_class:      string | null;
  weight_kg:         number | null;
  nationality:       string | null;
  hometown:          string | null;
  bio:               string | null;
  instagram_url:     string | null;
  profile_code:      string;
  height_cm:         number | null;
  stance:            'orthodox' | 'southpaw' | null;
  training_since:    string | null;
}
```

- [ ] **Schritt 3: State für QR-Sheet hinzufügen**

Nach `const [targetFightsLoading, setTargetFightsLoading]`:

```typescript
const [qrSheetVisible, setQrSheetVisible] = useState(false);
```

- [ ] **Schritt 4: Supabase-Select erweitern**

Im `useEffect` den `.select(...)` Call anpassen:

```typescript
.select('name, age_years, avatar_url, gender, disciplines, show_fight_record, show_stats, coach_verified_at, studio_id, nickname, weight_class, weight_kg, nationality, hometown, bio, instagram_url, profile_code, height_cm, stance, training_since')
```

Im `.then`-Callback das `setProfile`-Objekt um neue Felder ergänzen:

```typescript
setProfile({
  name:              data.name,
  age_years:         data.age_years,
  avatar_url:        data.avatar_url,
  gender:            data.gender ?? null,
  disciplines:       (data.disciplines as string[]) ?? [],
  show_fight_record: (data.show_fight_record as boolean) ?? true,
  show_stats:        (data.show_stats as boolean) ?? true,
  coach_verified_at: data.coach_verified_at ?? null,
  studio_id:         data.studio_id ?? null,
  nickname:          data.nickname ?? null,
  weight_class:      data.weight_class ?? null,
  weight_kg:         data.weight_kg ?? null,
  nationality:       data.nationality ?? null,
  hometown:          data.hometown ?? null,
  bio:               data.bio ?? null,
  instagram_url:     data.instagram_url ?? null,
  profile_code:      data.profile_code as string,
  height_cm:         data.height_cm ?? null,
  stance:            (data.stance as 'orthodox' | 'southpaw' | null) ?? null,
  training_since:    data.training_since ?? null,
});
```

- [ ] **Schritt 5: canRateNow und sparring-Params absichern**

Da `sparringId` und `sparringScheduledAt` jetzt optional sind:

```typescript
const { userId, sparringId, sparringScheduledAt } = params;

const { averageStars, ratingCount, existingRating, submitRating, canRate } =
  useSparringRatings(userId, sparringId ?? '', ratingTrigger);

const canRateNow =
  sparringId !== undefined &&
  sparringScheduledAt !== undefined &&
  canRate(sparringScheduledAt) &&
  existingRating === null;
```

- [ ] **Schritt 6: Share-Handler**

Nach `handleVouch`:

```typescript
const handleShare = useCallback(async () => {
  if (profile === null) return;
  await Share.share({
    message: `Kämpferprofil: ${profile.name ?? 'Unbekannt'} — Code: ${profile.profile_code}`,
  });
}, [profile]);
```

- [ ] **Schritt 7: Header — Share-Button ergänzen**

Im bestehenden Header-View nach dem Flag-Button:

```tsx
<TouchableOpacity
  onPress={() => setQrSheetVisible(true)}
  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
>
  <Ionicons name="share-outline" size={22} color={colors.text} />
</TouchableOpacity>
```

- [ ] **Schritt 8: Avatar-Hero ersetzen**

Den bestehenden `<View style={styles.avatarCircle}>` Block ersetzen durch:

```tsx
{profile?.avatar_url !== null && profile?.avatar_url !== undefined ? (
  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
) : (
  <View style={styles.avatarCircle}>
    <Text style={styles.avatarInitials}>{initials}</Text>
  </View>
)}
```

- [ ] **Schritt 9: Nickname unter dem Namen anzeigen**

Den bestehenden `nameRow`-Block ersetzen:

```tsx
<View style={styles.nameRow}>
  <Text style={styles.name}>{profile?.name ?? 'Unbekannt'}</Text>
  <VerifiedBadge tier={isVerified ? 'verified' : 'unverified'} size={22} />
</View>
{profile?.nickname !== null && profile?.nickname !== undefined && (
  <Text style={styles.nickname}>"{profile.nickname}"</Text>
)}
<Text style={styles.profileCode}>{profile?.profile_code ?? ''}</Text>
```

- [ ] **Schritt 10: Stats-Chips einfügen**

Nach dem `profileCode`-Text und vor dem Rating-Block:

```tsx
{profile?.show_stats === true && (
  <View style={styles.statsRow}>
    {profile.weight_class !== null && (
      <View style={styles.statChip}>
        <Text style={styles.statChipText}>{profile.weight_class}</Text>
      </View>
    )}
    {profile.stance !== null && (
      <View style={styles.statChip}>
        <Text style={styles.statChipText}>
          {profile.stance === 'orthodox' ? 'Orthodox' : 'Southpaw'}
        </Text>
      </View>
    )}
    {profile.height_cm !== null && (
      <View style={styles.statChip}>
        <Text style={styles.statChipText}>{profile.height_cm} cm</Text>
      </View>
    )}
    {profile.training_since !== null && (
      <View style={styles.statChip}>
        <Text style={styles.statChipText}>
          seit {profile.training_since.split('-')[0]}
        </Text>
      </View>
    )}
  </View>
)}
```

- [ ] **Schritt 11: Bio-Sektion einfügen**

Nach dem Rating-Block, vor den Disciplines:

```tsx
{profile?.bio !== null && profile?.bio !== undefined && (
  <View style={styles.bioCard}>
    <Text style={styles.bioText}>{profile.bio}</Text>
  </View>
)}
```

- [ ] **Schritt 12: Heimatstadt + Nationalität einfügen**

Nach den Disciplines, vor dem FightRecordCard:

```tsx
{profile?.show_stats === true && (profile?.hometown !== null || profile?.nationality !== null) && (
  <View style={styles.infoRow}>
    {profile?.nationality !== null && (
      <Text style={styles.infoText}>{profile.nationality}</Text>
    )}
    {profile?.hometown !== null && (
      <Text style={styles.infoText}>{profile.hometown}</Text>
    )}
  </View>
)}
```

- [ ] **Schritt 13: Instagram-Button einfügen**

Nach dem FightRecordCard-Block:

```tsx
{profile?.instagram_url !== null && profile?.instagram_url !== undefined && (
  <TouchableOpacity
    style={styles.instagramBtn}
    onPress={() => { void Linking.openURL(profile.instagram_url as string); }}
    activeOpacity={0.7}
  >
    <Ionicons name="logo-instagram" size={18} color={colors.text} />
    <Text style={styles.instagramBtnText}>Instagram</Text>
  </TouchableOpacity>
)}
```

- [ ] **Schritt 14: QR-Sheet als Modal anfügen**

Am Ende des ScrollView, als letztes Modal vor `</SafeAreaView>`:

```tsx
<Modal
  visible={qrSheetVisible}
  animationType="slide"
  transparent
  onRequestClose={() => setQrSheetVisible(false)}
>
  <TouchableOpacity
    style={styles.modalBackdrop}
    activeOpacity={1}
    onPress={() => setQrSheetVisible(false)}
  >
    <View style={styles.qrSheet}>
      <View style={styles.modalHandle} />
      <Text style={styles.modalTitle}>Profil teilen</Text>
      {profile !== null && (
        <QRCode
          value={profile.profile_code}
          size={200}
          color={colors.text}
          backgroundColor={colors.card}
        />
      )}
      <Text style={styles.qrCodeLabel}>{profile?.profile_code ?? ''}</Text>
      <TouchableOpacity
        style={styles.shareBtn}
        onPress={() => { void handleShare(); }}
        activeOpacity={0.8}
      >
        <Ionicons name="share-outline" size={18} color={colors.card} />
        <Text style={styles.shareBtnText}>Teilen</Text>
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
</Modal>
```

- [ ] **Schritt 15: Neue Styles hinzufügen**

Im `StyleSheet.create({...})` ergänzen:

```typescript
avatarImage: {
  width:        88,
  height:       88,
  borderRadius: 44,
  marginTop:    8,
},
nickname: {
  fontSize:  15,
  color:     colors.textSecondary,
  textAlign: 'center',
  fontStyle: 'italic',
},
profileCode: {
  fontSize:          12,
  color:             colors.inactive,
  textAlign:         'center',
  backgroundColor:   colors.background,
  paddingHorizontal: 10,
  paddingVertical:   3,
  borderRadius:      8,
},
statsRow: {
  flexDirection:  'row',
  flexWrap:       'wrap',
  gap:            8,
  justifyContent: 'center',
},
statChip: {
  backgroundColor:   colors.background,
  borderRadius:      8,
  paddingHorizontal: 12,
  paddingVertical:   4,
},
statChipText: {
  fontSize:   13,
  fontWeight: '500',
  color:      colors.text,
},
bioCard: {
  backgroundColor: colors.card,
  borderRadius:    12,
  padding:         16,
  alignSelf:       'stretch',
},
bioText: {
  fontSize:   14,
  color:      colors.text,
  lineHeight: 20,
},
infoRow: {
  flexDirection:  'row',
  gap:            16,
  justifyContent: 'center',
},
infoText: {
  fontSize:  13,
  color:     colors.textSecondary,
},
instagramBtn: {
  flexDirection:     'row',
  alignItems:        'center',
  gap:               8,
  paddingHorizontal: 16,
  paddingVertical:   10,
  borderRadius:      12,
  borderWidth:       1,
  borderColor:       colors.border,
},
instagramBtnText: {
  fontSize:   14,
  fontWeight: '500',
  color:      colors.text,
},
qrSheet: {
  backgroundColor:      colors.card,
  borderTopLeftRadius:  24,
  borderTopRightRadius: 24,
  padding:              24,
  paddingBottom:        40,
  alignItems:           'center',
  gap:                  16,
},
qrCodeLabel: {
  fontSize:   15,
  fontWeight: '700',
  color:      colors.text,
  letterSpacing: 2,
},
shareBtn: {
  flexDirection:     'row',
  alignItems:        'center',
  gap:               8,
  backgroundColor:   colors.accentBlue,
  borderRadius:      12,
  paddingHorizontal: 24,
  paddingVertical:   12,
},
shareBtnText: {
  fontSize:   15,
  fontWeight: '700',
  color:      colors.card,
},
```

- [ ] **Schritt 16: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: keine Fehler.

- [ ] **Schritt 17: Commit**

```bash
git add src/screens/PublicProfileScreen.tsx
git commit -m "feat(fighter-profile): redesign PublicProfileScreen with new fields, avatar image, and QR share"
```

---

### Task 8: ProfilScreen — FighterProfileCard + Profil-Code-Suche

**Files:**
- Modify: `src/screens/ProfilScreen.tsx`

- [ ] **Schritt 1: FighterProfileCard importieren**

In den Imports ergänzen:

```typescript
import FighterProfileCard from '../components/profil/FighterProfileCard';
```

- [ ] **Schritt 2: Navigation-Import sicherstellen**

Falls nicht bereits vorhanden, `useNavigation` importieren und nutzen:

```typescript
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
```

Am Anfang der Komponente:

```typescript
const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
```

- [ ] **Schritt 3: State für Profil-Code-Suche**

```typescript
const [searchCode,    setSearchCode]    = useState('');
const [searching,     setSearching]     = useState(false);
const [searchError,   setSearchError]   = useState<string | null>(null);
```

- [ ] **Schritt 4: Such-Handler**

```typescript
async function handleSearchByCode(): Promise<void> {
  const trimmed = searchCode.trim().toUpperCase();
  if (trimmed.length === 0) return;
  setSearching(true);
  setSearchError(null);
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('profile_code', trimmed)
    .single();
  setSearching(false);
  if (error !== null || data === null) {
    setSearchError('Kein Kämpfer mit diesem Code gefunden.');
    return;
  }
  setSearchCode('');
  navigation.navigate('PublicProfile', { userId: data.id });
}
```

- [ ] **Schritt 5: FighterProfileCard in die ScrollView einfügen**

Nach der bestehenden `DisciplinePickerCard` und vor `TeamPickerCard` (oder am Ende der Karten-Liste — wähle eine sinnvolle Position):

```tsx
<FighterProfileCard
  profile={profile}
  updateProfile={updateProfile}
/>
```

- [ ] **Schritt 6: Profil-Code-Card einfügen**

Nach FighterProfileCard:

```tsx
<View style={styles.codeCard}>
  <Text style={styles.codeCardTitle}>Mein Profil-Code</Text>
  <Text style={styles.codeValue}>{profile?.profile_code ?? '—'}</Text>

  <Text style={styles.codeCardLabel}>Kämpfer suchen</Text>
  <View style={styles.codeSearchRow}>
    <TextInput
      style={styles.codeInput}
      value={searchCode}
      onChangeText={(t) => { setSearchCode(t.toUpperCase()); setSearchError(null); }}
      placeholder="Code eingeben..."
      placeholderTextColor={colors.textSecondary}
      autoCapitalize="characters"
      maxLength={12}
    />
    <TouchableOpacity
      style={[styles.codeSearchBtn, searching && styles.codeSearchBtnDisabled]}
      onPress={() => { void handleSearchByCode(); }}
      disabled={searching}
      activeOpacity={0.8}
    >
      {searching
        ? <ActivityIndicator size="small" color={colors.card} />
        : <Ionicons name="search" size={18} color={colors.card} />
      }
    </TouchableOpacity>
  </View>
  {searchError !== null && (
    <Text style={styles.codeSearchError}>{searchError}</Text>
  )}
</View>
```

- [ ] **Schritt 7: Fehlende Styles hinzufügen**

```typescript
codeCard: {
  backgroundColor: colors.card,
  borderRadius:    16,
  padding:         16,
  gap:             8,
},
codeCardTitle: {
  fontSize:   15,
  fontWeight: '700',
  color:      colors.text,
},
codeValue: {
  fontSize:      22,
  fontWeight:    '800',
  color:         colors.accentBlue,
  letterSpacing: 3,
},
codeCardLabel: {
  fontSize:   12,
  fontWeight: '600',
  color:      colors.textSecondary,
  marginTop:  8,
},
codeSearchRow: {
  flexDirection: 'row',
  gap:           8,
},
codeInput: {
  flex:              1,
  backgroundColor:   colors.background,
  borderRadius:      10,
  paddingHorizontal: 12,
  paddingVertical:   10,
  fontSize:          15,
  color:             colors.text,
  letterSpacing:     2,
},
codeSearchBtn: {
  width:           44,
  height:          44,
  borderRadius:    10,
  backgroundColor: colors.accentBlue,
  alignItems:      'center',
  justifyContent:  'center',
},
codeSearchBtnDisabled: {
  backgroundColor: colors.accentBlueMuted,
},
codeSearchError: {
  fontSize: 13,
  color:    colors.deleteRed,
},
```

- [ ] **Schritt 8: supabase und ActivityIndicator importieren**

Sicherstellen dass `supabase` und `ActivityIndicator` importiert sind (je nach bisherigem Import-Stand):

```typescript
import { supabase } from '../lib/supabase';
import { ..., ActivityIndicator } from 'react-native';
```

- [ ] **Schritt 9: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: keine Fehler.

- [ ] **Schritt 10: Commit**

```bash
git add src/screens/ProfilScreen.tsx
git commit -m "feat(fighter-profile): add FighterProfileCard and profile code search to ProfilScreen"
```

---

### Task 9: Abschluss — TypeScript + Tests

- [ ] **Schritt 1: Vollständige TypeScript-Prüfung**

```bash
npx tsc --noEmit
```

Erwartet: 0 Fehler. Alle neuen Felder korrekt getypt, keine `any`-Verwendung.

- [ ] **Schritt 2: Bestehende Tests laufen lassen**

```bash
npx jest
```

Erwartet: alle Tests grün. Die Änderungen betreffen keine Utils mit Tests.

- [ ] **Schritt 3: Abschluss-Commit**

```bash
git add -p
git commit -m "feat(fighter-profile): complete fighter profile — new fields, redesigned PublicProfileScreen, QR share, pro/amateur toggle"
```
