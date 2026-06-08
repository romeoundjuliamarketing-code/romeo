# Commit Source Files for EAS Build

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Commit all untracked app source files to Git so the EAS preview build has access to the complete codebase.

**Architecture:** The EAS build system reads exclusively from Git. ~60 source files (screens, hooks, components, utils, types, configs) were never committed — they only existed on the local filesystem. Adding them to Git gives EAS the complete picture.

**Tech Stack:** Git, EAS CLI (Expo Application Services)

---

### Task 1: Stage all source files and config

**Files:**
- Stage: `babel.config.js`, `metro.config.js`
- Stage: `src/` (all subdirectories)
- Stage: `assets/logo-home.png`, `assets/coach/`
- Stage: `supabase/` (migrations)
- Do NOT stage: `.env`, `romepo/`, `screenshots/`, `obsidian-setup/`, `*.docx`, `PLANS.md`, `PRICING_MODEL.md`, `PAYMENTS_SETUP.md`

- [ ] **Step 1: Verify .env is gitignored**

```bash
cat .gitignore | grep "\.env"
```
Expected output: `.env` appears — confirms secrets are protected.

- [ ] **Step 2: Stage source files**

```bash
git add babel.config.js metro.config.js
git add assets/logo-home.png assets/coach/
git add src/
git add supabase/
```

- [ ] **Step 3: Verify staged files look correct (no secrets)**

```bash
git diff --cached --name-only | head -80
```
Expected: Long list of `src/`, `assets/`, config files. `.env` must NOT appear.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore: track all source files in version control

App was developed locally without committing ~60 source files.
EAS builds read from Git, so all preview builds were failing.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

Expected: Commit succeeds with summary like `63 files changed`.

---

### Task 2: Trigger EAS preview build

- [ ] **Step 1: Start the build**

```bash
eas build --profile preview --platform ios
```

Wait for completion (typically 5-10 minutes).

- [ ] **Step 2: Verify build succeeds**

Expected: `Build finished` with a QR code / install link. No `exited with non-zero code` error.

- [ ] **Step 3: Install on device and verify app launches**

Scan the QR code with your iPhone or open the install link in Safari on the device.

Confirm: App launches, no MIME-type error.
