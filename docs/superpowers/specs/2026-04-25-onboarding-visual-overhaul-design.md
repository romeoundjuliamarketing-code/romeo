# Onboarding Visual Overhaul — Design Spec

Date: 2026-04-25
Status: Approved

## Goal

Improve the onboarding experience visually and interactively without changing the existing layout (large mascot stays). Keep the "Weiter" button flow.

## Scope

Option B: mascot size unchanged, step UIs upgraded.

## Changes

### 1. Content Slide Animation (`OnboardingScreen.tsx`)

When `stepIndex` changes, the step content area animates in addition to the mascot:

- **Forward**: new content slides in from right (+screenWidth → 0), fade-in simultaneously
- **Back**: new content slides in from left (-screenWidth → 0), fade-in simultaneously
- Duration: ~220ms, spring (tension 60, friction 10), `useNativeDriver: true`
- Implementation: `Animated.Value` for `translateX` + `opacity` on the `<ScrollView>` wrapper

Direction tracking: a `directionRef` (`useRef`) stores `'forward' | 'back'` before each `setStepIndex` call so the animation knows which side to enter from.

### 2. Checkmark on Selected Options

**StepExperience.tsx** and **StepTrainingFrequency.tsx**:
- Add `checkmark-circle` (Ionicons, size 20, color `#FFFFFF`) on the right side of the active row
- Inactive rows: no icon (keeps layout clean, no placeholder icon)

**StepGender.tsx**:
- Add `checkmark-circle` (Ionicons, size 16, color `#FFFFFF`) below the label in active cards
- Inactive cards: no icon

### 3. Progress Bar (`OnboardingScreen.tsx`)

- Height: 3px → 5px
- Fill color: `colors.text` (#141414) → `colors.accentBlue` (#4A90D9)

### 4. "Weiter" Button Pulse Animation (`OnboardingScreen.tsx`)

When `canContinue()` transitions from `false` → `true` (tracked via `useEffect` + `useRef`):
- Scale animation: 1.0 → 1.04 → 1.0 over ~300ms
- `useNativeDriver: true`
- Does not fire on the Welcome screen (always continuable)

## Files Changed

| File | Change |
|------|--------|
| `src/screens/OnboardingScreen.tsx` | Content animation + button pulse + progress bar |
| `src/components/onboarding/StepExperience.tsx` | Checkmark on active row |
| `src/components/onboarding/StepTrainingFrequency.tsx` | Checkmark on active row |
| `src/components/onboarding/StepGender.tsx` | Checkmark in active card |

## Out of Scope

- Auto-advance on selection (user prefers explicit "Weiter")
- Mascot size changes
- Step order changes
- New steps
