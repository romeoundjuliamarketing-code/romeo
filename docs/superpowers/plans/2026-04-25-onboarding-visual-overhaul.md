# Onboarding Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the onboarding step transitions with a content-slide animation, add checkmark feedback on selected options, make the progress bar more visible, and pulse the "Weiter" button when a selection becomes valid.

**Architecture:** All changes are contained to existing files — no new files created. `OnboardingScreen.tsx` gets two `Animated.Value` refs (content `translateX` + button `scale`) driven by `stepIndex` changes. The three step components (`StepGender`, `StepExperience`, `StepTrainingFrequency`) each get a `checkmark-circle` icon on their active option.

**Tech Stack:** React Native `Animated` API (`useNativeDriver: true`), `@expo/vector-icons` Ionicons (already imported in `StepGender`), TypeScript strict.

---

## File Map

| File | Change |
|------|--------|
| `src/screens/OnboardingScreen.tsx` | Content slide animation + button pulse + progress bar height/color |
| `src/components/onboarding/StepGender.tsx` | Checkmark icon in active card |
| `src/components/onboarding/StepExperience.tsx` | Checkmark icon on active row |
| `src/components/onboarding/StepTrainingFrequency.tsx` | Checkmark icon on active row |

No new files. No tests (UI screens are excluded per project rules). After each task: `npx tsc --noEmit`.

---

## Task 1: Progress bar — height and color

**Files:**
- Modify: `src/screens/OnboardingScreen.tsx`

- [ ] **Step 1: Update `progressTrack` height and `progressFill` color**

In `OnboardingScreen.tsx`, find the `StyleSheet.create` block at the bottom. Change:

```ts
progressTrack: {
  flex: 1,
  height: 5,           // was 3
  backgroundColor: colors.border,
  borderRadius: 2,
  overflow: 'hidden',
  marginLeft: 8,
},
progressFill: {
  height: 5,           // was 3
  backgroundColor: colors.accentBlue,  // was colors.text
  borderRadius: 2,
},
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/OnboardingScreen.tsx
git commit -m "feat(onboarding): thicker progress bar with blue fill"
```

---

## Task 2: Checkmark in StepGender active card

**Files:**
- Modify: `src/components/onboarding/StepGender.tsx`

- [ ] **Step 1: Add Ionicons import**

`StepGender.tsx` currently imports from `react-native` and `@expo/vector-icons`. Add `Ionicons` if not already there — check the top of the file. The current import is:

```ts
import { Ionicons } from '@expo/vector-icons';
```

It is already there (used for the gender icons). No change needed.

- [ ] **Step 2: Add checkmark below label in active card**

In the `TouchableOpacity` render block, add a checkmark `View` after the `<Text style={[styles.label, ...]}>` element:

```tsx
<TouchableOpacity
  key={opt.value}
  style={[styles.option, active && styles.optionActive]}
  onPress={() => onChange(opt.value)}
  activeOpacity={0.75}
>
  <Ionicons
    name={opt.icon}
    size={28}
    color={active ? '#FFFFFF' : colors.text}
  />
  <Text style={[styles.label, active && styles.labelActive]}>
    {opt.label}
  </Text>
  {active && (
    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
  )}
</TouchableOpacity>
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/StepGender.tsx
git commit -m "feat(onboarding): checkmark on active gender card"
```

---

## Task 3: Checkmark in StepExperience active row

**Files:**
- Modify: `src/components/onboarding/StepExperience.tsx`

- [ ] **Step 1: Add Ionicons import**

At the top of `StepExperience.tsx`, add:

```ts
import { Ionicons } from '@expo/vector-icons';
```

- [ ] **Step 2: Add checkmark on right side of active row**

The current row renders `label` left, `sub` right. Change to: `label` + `sub` in a left column, checkmark far right only when active.

Replace the `TouchableOpacity` contents:

```tsx
<TouchableOpacity
  key={opt.value}
  style={[styles.option, active && styles.optionActive]}
  onPress={() => onChange(opt.value)}
  activeOpacity={0.75}
>
  <View style={styles.textCol}>
    <Text style={[styles.label, active && styles.labelActive]}>
      {opt.label}
    </Text>
    <Text style={[styles.sub, active && styles.subActive]}>
      {opt.sub}
    </Text>
  </View>
  {active && (
    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
  )}
</TouchableOpacity>
```

Add `textCol` to `StyleSheet.create`:

```ts
textCol: {
  flex: 1,
},
```

Remove the existing `justifyContent: 'space-between'` from `option` style (the checkmark replaces that role), and keep the rest as-is:

```ts
option: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 16,
  borderRadius: 16,
  backgroundColor: colors.card,
  borderWidth: 2,
  borderColor: 'transparent',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
},
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/StepExperience.tsx
git commit -m "feat(onboarding): checkmark on active experience row"
```

---

## Task 4: Checkmark in StepTrainingFrequency active row

**Files:**
- Modify: `src/components/onboarding/StepTrainingFrequency.tsx`

- [ ] **Step 1: Add Ionicons import**

```ts
import { Ionicons } from '@expo/vector-icons';
```

- [ ] **Step 2: Same pattern as StepExperience**

Replace the `TouchableOpacity` contents:

```tsx
<TouchableOpacity
  key={opt.value}
  style={[styles.option, active && styles.optionActive]}
  onPress={() => onChange(opt.value)}
  activeOpacity={0.75}
>
  <View style={styles.textCol}>
    <Text style={[styles.label, active && styles.labelActive]}>
      {opt.label}
    </Text>
    <Text style={[styles.sub, active && styles.subActive]}>
      {opt.sub}
    </Text>
  </View>
  {active && (
    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
  )}
</TouchableOpacity>
```

Add `textCol` to `StyleSheet.create` and remove `justifyContent: 'space-between'` from `option`:

```ts
textCol: {
  flex: 1,
},
option: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 16,
  borderRadius: 16,
  backgroundColor: colors.card,
  borderWidth: 2,
  borderColor: 'transparent',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
},
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/StepTrainingFrequency.tsx
git commit -m "feat(onboarding): checkmark on active frequency row"
```

---

## Task 5: Content slide animation + button pulse

**Files:**
- Modify: `src/screens/OnboardingScreen.tsx`

This is the largest task. Read the full current file before editing.

- [ ] **Step 1: Update React and React Native imports**

In `OnboardingScreen.tsx`, update the React import (currently `import React, { useState }`) to:

```ts
import React, { useState, useEffect, useRef } from 'react';
```

Update the React Native import to include `Animated` and `Dimensions`:

```ts
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
```

Add this constant right after the imports (before the `MASCOT` object):

```ts
const SCREEN_WIDTH = Dimensions.get('window').width;
```

- [ ] **Step 2: Add animation refs and direction tracking**

Add these refs directly after the existing state declarations (after `const [inviteCode, setInviteCode] = useState('');`):

```ts
const contentTranslateX = useRef(new Animated.Value(0)).current;
const contentOpacity    = useRef(new Animated.Value(1)).current;
const buttonScale       = useRef(new Animated.Value(1)).current;
const directionRef      = useRef<'forward' | 'back'>('forward');
const prevCanContinue   = useRef(false);
```

- [ ] **Step 3: Add content animation effect**

Add this `useEffect` after the refs, before `isWelcome`:

```ts
useEffect(() => {
  const startX = directionRef.current === 'forward' ? SCREEN_WIDTH : -SCREEN_WIDTH;
  contentTranslateX.setValue(startX);
  contentOpacity.setValue(0);
  Animated.parallel([
    Animated.spring(contentTranslateX, {
      toValue: 0,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }),
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }),
  ]).start();
}, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps
```

Add `SCREEN_WIDTH` import at the top of the file (after the React Native imports):

```ts
import { Dimensions } from 'react-native';
const SCREEN_WIDTH = Dimensions.get('window').width;
```

- [ ] **Step 4: Add button pulse effect**

Compute `isReady` as a constant right before the `isWelcome` line:

```ts
const isReady = canContinue();
```

Then add this `useEffect` after the content animation effect. It watches `isReady` to detect the false→true transition:

```ts
useEffect(() => {
  if (isReady && !prevCanContinue.current && !isWelcome) {
    Animated.sequence([
      Animated.spring(buttonScale, { toValue: 1.04, tension: 200, friction: 5, useNativeDriver: true }),
      Animated.spring(buttonScale, { toValue: 1.0,  tension: 200, friction: 5, useNativeDriver: true }),
    ]).start();
  }
  prevCanContinue.current = isReady;
}, [isReady, isWelcome]); // eslint-disable-line react-hooks/exhaustive-deps
```

Everywhere `canContinue()` is called in JSX/logic, replace with `isReady` (already computed above). Specifically:
- `style={[styles.btn, !isReady && styles.btnDisabled]}`
- `disabled={saving || !isReady}`
- `const canContinue = (): boolean => { ... }` function stays — `isReady` just calls it once per render.

- [ ] **Step 5: Update `handleNext` and `handleBack` to set direction**

In `handleNext`, add `directionRef.current = 'forward';` before `setStepIndex`:

```ts
const handleNext = async () => {
  if (!canContinue()) return;
  const isLastStep = stepIndex === STEPS.length - 1;
  if (isLastStep) {
    if (currentStep?.id === 'invitecode' && inviteCode.trim().length > 0) {
      setSaving(true);
      const { error: inviteErr, studioId } = await acceptInvite(inviteCode.trim());
      if (inviteErr !== null) {
        setSaving(false);
        setError('Ungültiger Code. Bitte prüfe den Code und versuche es erneut.');
        return;
      }
      if (studioId !== null) await joinStudio(studioId);
      setSaving(false);
    }
    await handleFinish();
  } else {
    setError(null);
    directionRef.current = 'forward';
    setStepIndex((i) => i + 1);
  }
};
```

In `handleBack`:

```ts
const handleBack = () => {
  setError(null);
  directionRef.current = 'back';
  setStepIndex((i) => i - 1);
};
```

- [ ] **Step 6: Wrap ScrollView in Animated.View**

In the JSX, wrap the `<ScrollView>` with an `Animated.View` that applies the translation and opacity:

```tsx
<Animated.View
  style={[
    styles.contentAnimWrapper,
    {
      transform: [{ translateX: contentTranslateX }],
      opacity: contentOpacity,
    },
  ]}
>
  <ScrollView
    contentContainerStyle={styles.scroll}
    keyboardShouldPersistTaps="handled"
    showsVerticalScrollIndicator={false}
  >
    {/* existing step content unchanged */}
  </ScrollView>
</Animated.View>
```

Add to `StyleSheet.create`:

```ts
contentAnimWrapper: {
  flex: 1,
},
```

- [ ] **Step 7: Wrap the "Weiter" button in Animated.View**

In the footer, wrap the `TouchableOpacity` with an `Animated.View`:

```tsx
<View style={styles.footer}>
  <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
    <TouchableOpacity
      style={[styles.btn, !canContinue() && styles.btnDisabled]}
      onPress={handleNext}
      disabled={saving || !canContinue()}
      activeOpacity={0.85}
    >
      {saving ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.btnText}>{buttonLabel}</Text>
      )}
    </TouchableOpacity>
  </Animated.View>
</View>
```

- [ ] **Step 8: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/screens/OnboardingScreen.tsx
git commit -m "feat(onboarding): content slide animation and button pulse"
```

---

## Task 6: Manual smoke test

- [ ] **Step 1: Start simulator**

```bash
npx expo run:ios
```

- [ ] **Step 2: Reset onboarding for test user**

In Supabase SQL editor:
```sql
UPDATE profiles SET onboarding_completed = false WHERE id = (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1);
```

- [ ] **Step 3: Walk through all 8 steps and verify**

Check each of these:
1. Welcome → tap "Los geht's" → content slides in from right
2. Name step: type name → "Weiter" button pulses when text is entered
3. Discipline step: tap chips, verify active state
4. Experience step: tap option → checkmark appears on right, "Weiter" pulses
5. Gender step: tap card → checkmark appears below label, "Weiter" pulses
6. Age step: scroll and tap age
7. Weight step: enter weight or tap "Lieber nicht angeben"
8. Training Frequency step: tap option → checkmark appears, "Weiter" pulses
9. Invite code step: tap "Überspringen" → finishes onboarding
10. Tap "Zurück" on any step → content slides in from left
11. Progress bar is blue and visibly thicker than before
