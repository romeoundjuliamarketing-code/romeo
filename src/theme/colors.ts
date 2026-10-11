export const colors = {
  // ── Surfaces ──────────────────────────────────────────────────────────────
  background: '#F7F5F0',
  card:       '#FFFFFF',

  // ── Typography ────────────────────────────────────────────────────────────
  text:          '#141414', // near-black body text
  textPrimary:   '#141414',
  textSecondary: '#8A8A8A',
  textTertiary:  '#8A8A8A',
  inactive:      '#8A8A8A', // alias → textTertiary
  textMuted:     '#6B6B6B', // small secondary text on off-white (≥ 4.5:1)
  hairline:      '#E2DFD8', // fine section divider on off-white
  fieldBorder:   '#D6D2C9', // warm-grey input border on white (login)

  // ── Accent ────────────────────────────────────────────────────────────────
  accent:          '#C8A882', // warm gold (legacy, prefer accentBlue)
  accentLight:     'rgba(200,168,130,0.15)',
  accentBlue:      '#4A90D9', // primary interactive accent
  accentBlueMuted: 'rgba(74,144,217,0.3)',
  accentBlueSoft:  'rgba(74,144,217,0.15)',
  accentBluePressed: '#3A78BB', // primary button while held down
  accentBlueText:  '#2F6CAD', // blue for text/links on light surfaces (>= 4.5:1)
  accentBlueTint:  '#E3ECF7', // light brand-blue surface (login / intro backdrop)

  // ── Borders ───────────────────────────────────────────────────────────────
  border:       'rgba(20,20,20,0.08)',
  tabBar:       '#FFFFFF',
  tabBarBorder: 'rgba(20,20,20,0.08)', // alias → border
  tabInactive:  '#A3A3A3', // inactive tab icon/label on the dark tab bar (>= 7:1 on dark)

  // ── Dark section (hero / coach) ───────────────────────────────────────────
  dark:                '#0A0A0A',
  darkMuted:           'rgba(10,10,10,0.06)',
  headerBg:            '#0A0A0A', // alias → dark
  headerCard:          'rgba(255,255,255,0.08)',
  headerTextPrimary:   '#FFFFFF',
  headerTextSecondary: 'rgba(255,255,255,0.65)',
  headerBorder:        'rgba(255,255,255,0.25)',
  headerDotFuture:     'rgba(255,255,255,0.1)',

  // ── Challenge cards (solid fills — stacked cards must not be translucent) ──
  cardStackNear: '#3B78B6', // card resting directly under the top one
  cardStackFar:  '#2F6091', // the one below that
  cardBackTop:     '#5A9CE0', // card back gradient, upper edge
  cardBackBottom:  '#3F82C9', // card back gradient, lower edge
  cardBackKeyline: 'rgba(255,255,255,0.30)', // fine inset contour on the back
  cardBackPattern: 'rgba(255,255,255,0.10)', // ring-corner ropes on the back

  // ── Card game screen (SparringChallengeScreen only) ───────────────────────
  gameBackground:  '#101318', // anthracite behind the deck
  gameSurface:     '#1C2129', // secondary button after the reveal
  gameShadow:      '#000000', // drop shadow under the deck

  // ── Module category left borders ──────────────────────────────────────────
  catSchlagkraft:      '#0A0A0A',
  catTrittkraft:       '#C4704F',
  catSchulter:         '#3D6B9E',
  catNackenhals:       '#5E7AA3',
  catGriffkraft:       '#4F6D7A',
  catCore:             '#2D6E6E',
  catCardio:           '#B8975A',
  catMobility:         '#7B6FA0',
  catPartnertraining:  '#4A7C59',

  // ── Semantic status ───────────────────────────────────────────────────────
  deleteRed:        '#D94A4A',
  deleteRedSoft:    'rgba(217,74,74,0.08)',  // tinted bg for decline actions
  difficultyGreen:  '#52C41A',
  difficultyGreenSoft: 'rgba(82,196,26,0.1)', // tinted bg for confirm actions
  sparringsOrange:  '#F5820A', // Demnächst-Marker auf der Sparring-Karte
  studioGreen:      '#22C55E', // Am-Studio-Marker auf der Sparring-Karte
  studioGold:       '#D4B942', // Studio-Marker auf der Sparring-Karte
  mobilityOrange:   '#E07B5A', // DailyMobilityCard + DailyStretchCard Akzentfarbe

  // ── Donut chart segments ───────────────────────────────────────────────────
  chartK1:    '#0A0A0A',
  chartBoxen: '#4A90D9',
  chartBJJ:   '#2D6B9E',
  chartMMA:   '#6BAED6',
  chartKraft: '#1A1A2E',
  chartExtra: '#8CB8E0',

  // ── Visualization palette (chart bars, member avatars) ────────────────────
  paletteRed:     '#E05252',
  paletteOrange:  '#E07A52',
  paletteGreen:   '#52A86E',
  paletteTeal:    '#52A8A8',
  paletteBrown:   '#A06428',
  paletteYellow:  '#D4B942',
  palettePink:    '#C052A8',
  paletteLime:    '#7DC452',
  paletteViolet:  '#7B52C4',
  paletteCrimson: '#C42828',
  paletteNavy:    '#1A5296',
  paletteForest:  '#1A7A3C',

  // ── Brand (login/register, profile) ───────────────────────────────────────
  brandNight:       '#101C36',                  // hero gradient, top-left
  brandRoyalDeep:   '#234DB5',                  // hero gradient, bottom-right
  brandGlow:        '#5B8BFF',                  // soft light bloom in the hero
  brandHeroLine:    'rgba(255,255,255,0.10)',   // abstract motion lines
  brandHeroText:    '#B7C4E3',                  // light blue-grey on the hero
  brandHeroChip:    'rgba(255,255,255,0.12)',   // back button / logo backdrop
  brandSurface:     '#F5F7FC',                  // light page / form surface
  brandInk:         '#15213F',                  // dark blue labels on the surface
  brandBorder:      '#D3DBEA',                  // fine blue-grey field border
  brandMuted:       '#8C98B5',
  brandPrimary:     '#2455DB',                  // royal blue: main button + links
  brandPrimarySoft: 'rgba(36,85,219,0.14)',     // focus ring / info background
  brandAccent:      '#F7C21A',                  // penguin-beak yellow, tiny accents only

  // ── Coach dialog (comic speech bubble + chunky buttons) ──────────────────
  coachBubble:      '#FFFCF5',                 // warm bubble / secondary answer fill
  tourPill:         'rgba(10,10,10,0.72)',     // coach tour: compact progress/skip row over the app
  coachButtonEdge:  '#163A9C',                  // pressable bottom edge under brandPrimary

  // ── Overlays ──────────────────────────────────────────────────────────────
  mapOverlay:       'rgba(0,0,0,0.55)',
  heroBannerScrim:  'rgba(0,0,0,0.25)',
  heroFloatingBtn:  'rgba(0,0,0,0.5)',

  // ── Profile cover / gym banner (on dark or photo) ─────────────────────────
  coverRope:        'rgba(255,255,255,0.14)',  // ring-rope lines of the cover fallback
  coverTextMuted:   'rgba(255,255,255,0.82)',  // small text on the darkened cover
  coverChip:        'rgba(10,10,10,0.45)',     // round toolbar buttons over a photo
  flagGloss:        'rgba(255,255,255,0.30)',  // cartoon highlight on flag stickers

  // ── Home event ticket (next sparring) ─────────────────────────────────────
  ticketBlue:       '#173F68',                 // ticket surface (white text >= 10:1)
  ticketBlueDeep:   '#11314F',                 // set-off action strip at the bottom
  ticketTextMuted:  'rgba(255,255,255,0.78)',  // small secondary text on the ticket
  ticketRope:       'rgba(255,255,255,0.09)',  // faint ring ropes behind the content
  ticketChip:       'rgba(255,255,255,0.14)',  // status chip / chat disc on the ticket
  ticketDivider:    'rgba(255,255,255,0.16)',

  // ── Sparring detail sheet (invitation) ────────────────────────────────────
  dateBand:         '#3A78BB',                 // blue date band (white text >= 4.5:1)
  dateBandDivider:  'rgba(255,255,255,0.35)',  // line between date and time on the band
  sheetScrim:       'rgba(10,10,10,0.68)',     // strong dim behind the sheet
  accentBlueEdge:   '#2F6CAD',                 // darker bottom edge of the blue depth button
  ticketDash:       '#CFCAC0',                 // dashed ticket edge above the action area
  noteSurface:      '#EEF3F9',                 // calm note area of the organizer's text

  // ── Avatar fallbacks (initials / chat tile; text stays colors.text) ───────
  avatarSky:        '#D6E6F5',
  avatarSage:       '#D9E4D3',
  avatarSand:       '#EEE2CC',
  avatarLavender:   '#E1DCEE',
};
