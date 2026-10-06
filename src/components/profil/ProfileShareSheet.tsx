import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, Share, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import RNShare from 'react-native-share';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../../theme/colors';
import { CARD_FRAMES, CARD_FRAME_IDS, cardFrame } from '../../data/cardFrames';
import type { CardFrameId } from '../../data/cardFrames';
import FighterCard, { CardFront } from './FighterCard';
import type { FighterCardData } from './FighterCard';
import { PrimaryButton, SecondaryButton } from './ProfileParts';
import SparrLogo from '../common/SparrLogo';

interface Props {
  visible:      boolean;
  onClose:      () => void;
  data:         FighterCardData;
  profileCode:  string | null;
  isOwn:        boolean;
  /** Own profile only: persists the chosen frame. */
  onSelectFrame?: (frame: CardFrameId) => Promise<{ error: string | null }>;
}

// Story canvas in logical points; exported at 1080×1920 (9:16).
const STORY_W = 360;
const STORY_H = 640;
const STORY_PHOTO_H = 128;

// "Profil teilen": the collectible fighter card as a shareable profile. Image
// export (9:16 story with the card front + QR of the profile ID) and sharing
// the profile ID as text are separate — a link inside an image is not tappable.
// Only public card-front data goes into the image.
export default function ProfileShareSheet({
  visible, onClose, data, profileCode, isOwn, onSelectFrame,
}: Props): React.ReactElement {
  const [frameId, setFrameId] = useState<CardFrameId>(cardFrame(data.frame).id);
  const [savingFrame, setSavingFrame] = useState(false);
  const [exporting, setExporting] = useState(false);
  const storyRef = useRef<ViewShot>(null);
  // Insets from the provider: a SafeAreaView at the root of a fullScreen
  // Modal can measure zero insets, pushing the close button under the status bar.
  const insets = useSafeAreaInsets();

  // Opening the sheet always starts with the saved frame
  // (keyed on `visible` only, so saving a frame is not reset).
  useEffect(() => {
    if (visible) {
      setFrameId(cardFrame(data.frame).id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const previewData: FighterCardData = { ...data, frame: frameId };
  const frame = cardFrame(frameId);

  async function handleSelectFrame(id: CardFrameId): Promise<void> {
    if (onSelectFrame === undefined || id === frameId || savingFrame) return;
    const previous = frameId;
    setFrameId(id);
    setSavingFrame(true);
    const { error } = await onSelectFrame(id);
    setSavingFrame(false);
    if (error !== null) {
      setFrameId(previous);
      Alert.alert('Fehler', 'Der Kartenrahmen konnte nicht gespeichert werden.');
    }
  }

  async function handleShareImage(): Promise<void> {
    setExporting(true);
    try {
      const uri = await storyRef.current?.capture?.();
      if (!uri) throw new Error('capture failed');
      // Native share sheet: "Bild sichern" / Instagram / messengers, as installed.
      await RNShare.open({ url: uri, type: 'image/png', failOnCancel: false });
    } catch {
      Alert.alert('Teilen nicht möglich', 'Das Bild konnte nicht erstellt werden. Bitte versuche es erneut.');
    } finally {
      setExporting(false);
    }
  }

  async function handleShareId(): Promise<void> {
    if (profileCode === null) return;
    const name = data.name?.trim() || 'Kämpfer';
    await Share.share({
      message: `${name} auf Sparr – Profil-ID: ${profileCode}. In der Sparr-App unter „Kämpfer suchen“ eingeben oder den QR-Code scannen.`,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.safe}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.title} accessibilityRole="header">Profil teilen</Text>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Schließen"
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.page}>
            {/* Shared profile shows the front only — no back side */}
            <FighterCard data={previewData} flipped={false} isOwn={isOwn} frontOnly />

            {isOwn && onSelectFrame !== undefined && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Karte gestalten</Text>
                <View style={styles.frames}>
                  {CARD_FRAME_IDS.map((id) => {
                    const f = CARD_FRAMES[id];
                    const selected = id === frameId;
                    return (
                      <TouchableOpacity
                        key={id}
                        style={styles.frameOption}
                        onPress={() => { void handleSelectFrame(id); }}
                        accessibilityRole="button"
                        accessibilityLabel={`Rahmen ${f.label}`}
                        accessibilityState={{ selected }}
                      >
                        <View style={[styles.swatch, { backgroundColor: f.cardBg, borderColor: f.border, borderWidth: f.borderWidth }]}>
                          <View style={[styles.swatchBand, { backgroundColor: f.band }]} />
                        </View>
                        <Text style={[styles.frameLabel, selected && styles.frameLabelActive]}>{f.label}</Text>
                        {selected && <Ionicons name="checkmark-circle" size={18} color={colors.accentBlue} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.block}>
              <PrimaryButton
                icon="image-outline"
                label="Story-Bild teilen"
                loading={exporting}
                onPress={() => { void handleShareImage(); }}
              />
              <Text style={styles.note}>
                Hochformat 9:16 mit der Vorderseite der Karte und einem QR-Code. Speichern oder in eine Story posten
                geht über das Teilen-Menü deines Handys.
              </Text>
            </View>

            {profileCode !== null && (
              <View style={styles.block}>
                <SecondaryButton icon="share-social-outline" label="Profil-ID teilen" onPress={() => { void handleShareId(); }} />
                <Text style={styles.note}>
                  Profil-ID {profileCode}. Einen Web-Link für Profile gibt es noch nicht – die ID und der QR-Code
                  funktionieren in der Sparr-App unter „Kämpfer suchen“.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Off-screen 9:16 story canvas — public card front + QR only */}
        <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ViewShot ref={storyRef} options={{ format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1920 }}>
            <View style={styles.story}>
              <View style={[styles.storyCard, { backgroundColor: frame.cardBg, borderColor: frame.border, borderWidth: frame.borderWidth }]}>
                <CardFront data={previewData} frame={frame} photoHeight={STORY_PHOTO_H} />
              </View>
              {profileCode !== null && (
                <View style={styles.storyFooter}>
                  <View style={styles.storyQr}>
                    <QRCode value={profileCode} size={64} color={colors.dark} backgroundColor={colors.card} />
                  </View>
                  <View style={styles.storyFooterText}>
                    <View style={styles.storyBrand}>
                      <SparrLogo size={18} />
                      <Text style={styles.storyBrandText}>Sparr</Text>
                    </View>
                    <Text style={styles.storyHint}>In der Sparr-App unter „Kämpfer suchen“ scannen</Text>
                  </View>
                </View>
              )}
            </View>
          </ViewShot>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingLeft:       16,
    paddingRight:      16,
    paddingBottom:     8,
  },
  title: {
    fontSize:   22,
    fontWeight: '900',
    color:      colors.text,
  },
  closeBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop:        8,
  },
  page: {
    width:     '100%',
    maxWidth:  420,
    alignSelf: 'center',
    gap:       24,
  },
  block: {
    gap: 8,
  },
  blockTitle: {
    fontSize:   15,
    fontWeight: '800',
    color:      colors.text,
  },
  frames: {
    flexDirection: 'row',
    gap:           8,
  },
  frameOption: {
    flex:              1,
    alignItems:        'center',
    gap:               8,
    paddingVertical:   8,
    minHeight:         44,
  },
  swatch: {
    width:          56,
    height:         72,
    borderRadius:   8,
    overflow:       'hidden',
    justifyContent: 'center',
  },
  swatchBand: {
    height: 16,
  },
  frameLabel: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.textMuted,
  },
  frameLabelActive: {
    fontWeight: '800',
    color:      colors.text,
  },
  note: {
    fontSize:   13,
    lineHeight: 18,
    color:      colors.textMuted,
  },
  offscreen: {
    position: 'absolute',
    left:     -10000,
    top:      0,
    width:    STORY_W,
  },
  story: {
    width:             STORY_W,
    height:            STORY_H,
    backgroundColor:   colors.background,
    // Keep clear of the story UI: profile bar on top, reply field at the bottom.
    paddingTop:        64,
    paddingBottom:     96,
    paddingHorizontal: 24,
    justifyContent:    'center',
    gap:               16,
  },
  storyCard: {
    borderRadius: 24,
    overflow:     'hidden',
  },
  storyFooter: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
  },
  storyQr: {
    padding:         8,
    borderRadius:    8,
    backgroundColor: colors.card,
  },
  storyFooterText: {
    flex: 1,
    gap:  4,
  },
  storyBrand: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  storyBrandText: {
    fontSize:   16,
    fontWeight: '900',
    color:      colors.text,
  },
  storyHint: {
    fontSize:   12,
    lineHeight: 16,
    color:      colors.textMuted,
  },
});
