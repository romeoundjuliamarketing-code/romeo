# Stundenplan-Kalender (Bearbeiten) — Implementierungsplan

> **Für agentische Worker:** Task-für-Task mit superpowers:subagent-driven-development.
> Steps als Checkbox (`- [ ]`). Sonnet implementiert, Opus reviewt zwischen den Tasks.

**Goal:** Den Studio-Stundenplan-Editor (Owner/Coach) von einer Tagesliste auf eine
wischbare **Tages-Kalender-Ansicht** umstellen: Sessions als Zeit-Blöcke auf einer Zeitachse,
antippen = bearbeiten, leeren Slot/„+" = neu — visuell an das App-Design-System angepasst.

**Architecture:** Eine neue Komponente `StudioScheduleCalendar` ersetzt den Inhalt des
„Stundenplan bearbeiten"-Toggles in `StudioDetailScreen`. Sie rendert pro Wochentag eine
vertikale Zeitachse mit absolut positionierten Session-Blöcken; Wochentage werden über einen
horizontalen Pager (wischbar) + antippbare Pills gewechselt. Bearbeiten/Neu läuft über das
bestehende `ScheduleEntrySheet` (um einen Edit-Modus erweitert); Persistenz über
`useStudioScheduleEditor` (um `updateSession` erweitert). Die öffentliche Leseansicht für
Mitglieder bleibt unverändert.

**Tech Stack:** React Native + Expo SDK 55, Supabase (`studio_schedule`-Tabelle, direkte
Table-Writes unter bestehender Coach-RLS), TypeScript strict.

## Global Constraints

- **Verifikations-Gate:** Nach JEDER Änderung `npx tsc --noEmit` (muss clean sein). Keine
  Tests für reine UI-Komponenten (CLAUDE.md). `npx jest` nur falls ein Util mit Logik entsteht.
- **Design-System:** Farben NUR aus `src/theme/colors.ts` (kein Hardcoded-Hex). Abstände in
  8px-Vielfachen. KEIN Inline-`style={{}}` außer dynamisch berechneten numerischen Werten
  (Block-`top`/`height` aus Zeit) — die als Array-Style `[styles.x, { top, height }]`.
- **Icons:** nur `@expo/vector-icons`. Keine Emojis/Unicode-Symbole.
- **Sprache:** UI-Texte Deutsch, Umlaute immer Ä/Ö/Ü/ä/ö/ü. Code-Kommentare Englisch.
- **TypeScript:** strict, kein `any`, explizite Typen.
- **Scope:** Nur der Owner/Coach-Editor. Öffentliche Leseansicht NICHT anfassen. Kein Drag&Drop.
- **Daten:** `studio_schedule.start_time` ist in der DB `HH:MM:SS`; im Sheet/Editor `HH:MM`.
  Beim Lesen `.slice(0,5)`, beim Schreiben normalisiert `useStudioScheduleEditor` selbst.
- **Android:** Sheets/Modals fangen Hardware-Back (`onRequestClose`) — `ScheduleEntrySheet`
  macht das bereits.

---

## Dateistruktur

- **Neu:** `src/components/studio/StudioScheduleCalendar.tsx` — die Kalender-Tagesansicht.
- **Ändern:** `src/hooks/useStudioScheduleEditor.ts` — `updateSession` ergänzen.
- **Ändern:** `src/components/training/ScheduleEntrySheet.tsx` — Edit-Modus (`initialValues` + `onDelete`).
- **Ändern:** `src/screens/StudioDetailScreen.tsx` — `StudioScheduleSection` durch `StudioScheduleCalendar` ersetzen.
- **Evtl. löschen:** `src/components/team/StudioScheduleSection.tsx` — falls nach dem Umbau ungenutzt.

---

## Task 1: `updateSession` in `useStudioScheduleEditor`

**Files:** Modify `src/hooks/useStudioScheduleEditor.ts`

**Interfaces:**
- Produces: `updateSession: (id: string, entry: StudioSessionValues) => Promise<{ error: string | null }>` im Result-Objekt.

- [ ] **Step 1:** In `UseStudioScheduleEditorResult` ergänzen:
  ```ts
  updateSession: (id: string, entry: StudioSessionValues) => Promise<{ error: string | null }>;
  ```
- [ ] **Step 2:** Implementierung hinzufügen (analog `addSession`, aber `.update().eq('id', id)`):
  ```ts
  const updateSession = useCallback(
    async (id: string, entry: StudioSessionValues): Promise<{ error: string | null }> => {
      setSaving(true);
      const update = {
        day_of_week:      entry.day_of_week,
        training_name:    entry.training_name,
        start_time:       entry.start_time.length === 5 ? `${entry.start_time}:00` : entry.start_time,
        duration_min:     entry.duration_min,
        points_per_30min: entry.points_per_30min,
        training_type:    entry.training_type,
        coach_name:       entry.coach_name ?? null,
        drop_in_enabled:  entry.drop_in_enabled,
      };
      const { error } = await supabase.from('studio_schedule').update(update).eq('id', id);
      setSaving(false);
      if (error !== null) { reportNetworkError(error); } else { reportNetworkSuccess(); }
      return { error: error?.message ?? null };
    },
    [],
  );
  ```
- [ ] **Step 3:** `updateSession` ins `return`-Objekt aufnehmen.
- [ ] **Step 4:** `npx tsc --noEmit` → clean.
- [ ] **Step 5:** Commit
  ```bash
  git add src/hooks/useStudioScheduleEditor.ts
  git commit -m "feat(studio): updateSession in schedule editor hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Task 2: Edit-Modus für `ScheduleEntrySheet`

**Files:** Modify `src/components/training/ScheduleEntrySheet.tsx`

**Interfaces:**
- Consumes: `ScheduleEntryValues` (existiert bereits, exportiert).
- Produces: erweiterte Props `initialValues?: ScheduleEntryValues | null` und `onDelete?: () => void`.
  Bei gesetztem `initialValues` = Edit-Modus (vorbefüllt, Titel „Einheit bearbeiten", Button
  „Speichern", zusätzlich Löschen-Button wenn `onDelete` gesetzt). Ohne `initialValues` =
  unverändertes „Neu"-Verhalten.

- [ ] **Step 1:** `Props` erweitern:
  ```ts
  interface Props {
    visible:         boolean;
    initialDay:      number;
    onClose:         () => void;
    onConfirm:       (entry: ScheduleEntryValues) => void;
    showCoachFields?: boolean;
    initialValues?:  ScheduleEntryValues | null;
    onDelete?:       () => void;
  }
  ```
  Signatur: `({ visible, initialDay, onClose, onConfirm, showCoachFields = false, initialValues = null, onDelete })`.
- [ ] **Step 2:** Im `useEffect` (beim Öffnen) die Felder aus `initialValues` seeden, sonst leeren:
  ```ts
  React.useEffect(() => {
    if (!visible) return;
    if (initialValues !== null) {
      setSelectedDay(initialValues.day_of_week);
      setName(initialValues.training_name);
      setTime(initialValues.start_time.slice(0, 5));
      setDuration(String(initialValues.duration_min));
      setTrainingType(initialValues.training_type);
      setCoachName(initialValues.coach_name ?? '');
      setDropInEnabled(initialValues.drop_in_enabled);
    } else {
      setSelectedDay(initialDay);
      setName(''); setTime(''); setDuration('');
      setTrainingType(''); setCoachName(''); setDropInEnabled(false);
    }
    setTimeError(false);
    setDurationError(false);
  }, [visible, initialDay, initialValues]);
  ```
- [ ] **Step 3:** Titel + Confirm-Label vom Modus abhängig machen:
  - Titel: `{initialValues !== null ? 'Einheit bearbeiten' : 'Einheit hinzufügen'}`
  - Confirm-Label: `{initialValues !== null ? 'Speichern' : 'Hinzufügen'}`
- [ ] **Step 4:** Im Edit-Modus mit `onDelete` einen Löschen-Button zeigen (z.B. über der
  Abbrechen/Speichern-Reihe), in `colors.deleteRed`, der `onDelete()` aufruft. Nur rendern wenn
  `initialValues !== null && onDelete !== undefined`. StyleSheet entsprechend ergänzen (kein
  Hardcoded-Hex, 8px-Raster).
- [ ] **Step 5:** `npx tsc --noEmit` → clean. (Bestehende Aufrufer ohne neue Props müssen weiter
  typchecken — `initialValues`/`onDelete` sind optional.)
- [ ] **Step 6:** Commit
  ```bash
  git add src/components/training/ScheduleEntrySheet.tsx
  git commit -m "feat(schedule): edit mode for ScheduleEntrySheet (prefill + delete)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Task 3: `StudioScheduleCalendar` (wischbare Tagesansicht)

**Files:** Create `src/components/studio/StudioScheduleCalendar.tsx`

**Interfaces:**
- Consumes: `useStudioScheduleEditor` (`addSession`, `updateSession`, `deleteSession`, `saving`),
  `ScheduleEntrySheet` (mit `initialValues`/`onDelete`), `ScheduleEntryValues`,
  `StudioSchedule` (`src/types/database.types`).
- Produces: default-export `function StudioScheduleCalendar(props: { studioId: string; schedule: StudioSchedule[]; loading: boolean; onRefetch: () => void }): React.ReactElement`.

Verhalten:
- **Wochentag-Wechsel:** horizontaler `ScrollView` mit `pagingEnabled` (7 volle Bildschirm-
  breite Seiten, je ein Tag). Darüber eine Reihe antippbarer Pills Mo–So. Pill-Tap scrollt den
  Pager (via `ref.scrollTo({ x: pageWidth * day })`); `onMomentumScrollEnd` setzt `selectedDay`.
  Seitenbreite über `useWindowDimensions` (abzüglich der horizontalen Paddings).
- **Zeitachse je Tag:** vertikaler `ScrollView`. Konstante `PX_PER_MIN = 1` (60px/Stunde).
  Standardfenster `START_HOUR = 6`, `END_HOUR = 23`. Wenn eine Session des Tages früher beginnt
  oder später endet, Fenster entsprechend erweitern (min start / max end über alle Sessions des
  Tages berechnen, auf volle Stunde runden/aufrunden). Stunden-Labels links, je Stunde eine
  Trennlinie.
- **Session-Blöcke:** für jede Session des Tages (`schedule.filter(s => s.day_of_week === day)`)
  ein absolut positionierter Block: `top = (startMin - windowStartMin) * PX_PER_MIN`,
  `height = Math.max(duration_min * PX_PER_MIN, 32)`. Inhalt: Name, `start_time.slice(0,5)`,
  Dauer, Coach (falls vorhanden), Drop-in-Indikator (falls `drop_in_enabled`). Block-Hintergrund
  `colors.accentBlue`/`accentBlueSoft`, Text design-system-konform. `start_time.slice(0,5)` und
  Minuten-Helfer (`"HH:MM" -> Minuten`) lokal definieren.
- **Tap-Interaktionen:**
  - Block antippen → `ScheduleEntrySheet` im Edit-Modus: `initialValues` aus der Session
    gemappt (`day_of_week`, `training_name`, `start_time` (HH:MM), `duration_min`,
    `points_per_30min`, `training_type`, `coach_name`, `drop_in_enabled`), `showCoachFields`,
    `onConfirm` → `updateSession(session.id, values)`, `onDelete` → Bestätigungs-`Alert` →
    `deleteSession(session.id)`. Nach Erfolg `onRefetch()` + Sheet schließen.
  - Leere Fläche der Zeitachse antippen ODER ein „+"-Button → Add-Modus: `initialDay = selectedDay`,
    kein `initialValues`, `onConfirm` → `addSession(studioId, values)` → `onRefetch()`.
    (Optional: getippte Y-Position in eine Startstunde umrechnen und als Vorbefüllung nutzen — wenn
    zu komplex, nur „+"-Button mit `selectedDay`.)
- **Loading:** bei `loading || saving` `ActivityIndicator` (`colors.accentBlue`).
- **State:** `selectedDay: number`, `sheetVisible: boolean`, `editingSession: StudioSchedule | null`
  (null = Add-Modus). `initialValues` für das Sheet aus `editingSession` ableiten.

Visuell wie die übrigen Studio-Sektionen: helle `colors.card`-Fläche, `colors.background`,
`colors.text`, Akzent `colors.accentBlue`, Inter, 8px-Raster. KEINE dunkle Box.

- [ ] **Step 1:** Komponente gemäß obiger Spezifikation implementieren. Mapping-Helfer
  (`HH:MM`→Minuten, Session→`ScheduleEntryValues`) lokal und rein halten.
- [ ] **Step 2:** `npx tsc --noEmit` → clean.
- [ ] **Step 3:** Commit
  ```bash
  git add src/components/studio/StudioScheduleCalendar.tsx
  git commit -m "feat(studio): swipeable day-view schedule calendar editor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Task 4: In `StudioDetailScreen` einbinden

**Files:** Modify `src/screens/StudioDetailScreen.tsx`; evtl. Delete `src/components/team/StudioScheduleSection.tsx`

**Interfaces:**
- Consumes: `StudioScheduleCalendar` (Task 3).

- [ ] **Step 1:** Import ändern: `StudioScheduleSection` → `StudioScheduleCalendar` aus
  `../components/studio/StudioScheduleCalendar`.
- [ ] **Step 2:** Den Block `{canManage && scheduleEditorOpen && <StudioScheduleSection ... />}`
  (um Zeile 720-726) ersetzen durch:
  ```tsx
  {canManage && scheduleEditorOpen && (
    <StudioScheduleCalendar
      studioId={studioId}
      schedule={schedule}
      loading={scheduleLoading}
      onRefetch={refetchSchedule}
    />
  )}
  ```
  (Props/Variablen `schedule`, `scheduleLoading`, `refetchSchedule` existieren bereits.)
- [ ] **Step 3:** Prüfen, ob `StudioScheduleSection` noch irgendwo genutzt wird:
  `grep -rn "StudioScheduleSection" src/`. Wenn nur noch die eigene Datei übrig ist, diese mit
  `git rm src/components/team/StudioScheduleSection.tsx` löschen.
- [ ] **Step 4:** `npx tsc --noEmit` → clean (fängt verwaiste Imports).
- [ ] **Step 5:** Commit
  ```bash
  git add -A
  git commit -m "feat(studio): use day-view calendar in studio schedule editor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Self-Review (Spec-Abdeckung)

- **Wischbare Tagesansicht mit Zeitachse + Blöcken:** Task 3. ✔
- **Tap-to-edit bestehender Session (vorbefüllt) + Verschieben via neue Zeit:** Task 2 + Task 3. ✔
- **Leeren Slot/„+" → neu:** Task 3. ✔
- **Persistenz Update/Add/Delete:** Task 1 (`updateSession`) + bestehende add/delete. ✔
- **Visuell an App angepasst (helle Design-System-Karten):** Task 3 Global Constraints. ✔
- **Kein Drag&Drop, öffentliche Leseansicht unangetastet:** Scope respektiert (Task 4 ersetzt nur
  den Editor-Toggle-Inhalt). ✔
- **Keine neue Migration nötig:** `studio_schedule` Update-RLS existiert (Migration 20260505). ✔
