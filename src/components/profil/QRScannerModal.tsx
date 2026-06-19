import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
  headerTitle?: string;
  hintText?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QRScannerModal({
  visible,
  onClose,
  onScanned,
  headerTitle = 'QR-Code scannen',
  hintText = 'QR-Code des Kämpfers scannen',
}: QRScannerModalProps): React.ReactElement {
  const [permission, requestPermission] = useCameraPermissions();
  // Prevent multiple scanned callbacks from a single QR detection burst
  const scannedRef = useRef<boolean>(false);

  // Request permission when modal opens; reset the scan guard when visibility changes
  useEffect(() => {
    scannedRef.current = false;
    if (visible && permission !== null && !permission.granted) {
      void requestPermission();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleBarcodeScanned({ data }: { data: string }): void {
    if (scannedRef.current) return;
    scannedRef.current = true;
    // The QR value is the raw profile_code — pass it directly
    onScanned(data.trim().toUpperCase());
  }

  function handleOpenSettings(): void {
    void Linking.openSettings();
  }

  // ── Permission not yet determined ──
  const isLoading = permission === null;
  const isDenied = permission !== null && !permission.granted && !permission.canAskAgain;
  const canAskAgain = permission !== null && !permission.granted && permission.canAskAgain;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close" size={24} color={colors.card} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* ── Camera or fallback ── */}
        {isLoading && (
          <View style={styles.centerContent}>
            <Text style={styles.infoText}>Kamera wird vorbereitet...</Text>
          </View>
        )}

        {canAskAgain && (
          <View style={styles.centerContent}>
            <Ionicons name="camera-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.infoText}>Kamerazugriff erforderlich</Text>
            <Text style={styles.infoSubText}>
              Um den QR-Code eines Kämpferprofils zu scannen, benötigt Sparr Zugriff auf
              die Kamera.
            </Text>
            <TouchableOpacity
              style={styles.permissionBtn}
              onPress={() => { void requestPermission(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.permissionBtnText}>Kamerazugriff erlauben</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeTextBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeTextBtnLabel}>Schliessen</Text>
            </TouchableOpacity>
          </View>
        )}

        {isDenied && (
          <View style={styles.centerContent}>
            <Ionicons name="ban-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.infoText}>Kamerazugriff verweigert</Text>
            <Text style={styles.infoSubText}>
              Bitte erlaube den Kamerazugriff für Sparr in den Einstellungen deines Geräts.
            </Text>
            <TouchableOpacity
              style={styles.permissionBtn}
              onPress={handleOpenSettings}
              activeOpacity={0.8}
            >
              <Text style={styles.permissionBtnText}>Einstellungen öffnen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeTextBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeTextBtnLabel}>Schliessen</Text>
            </TouchableOpacity>
          </View>
        )}

        {permission !== null && permission.granted && (
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            {/* Scan frame overlay */}
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.frameWrapper}>
                <View style={styles.scanFrame}>
                  {/* Corner markers */}
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <Text style={styles.scanHint}>
                  {hintText}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: colors.dark,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.card,
  },
  headerSpacer: {
    width: 40,
  },

  // Camera
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },

  // Scan frame overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameWrapper: {
    alignItems: 'center',
    gap: 24,
  },
  scanFrame: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: colors.card,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  scanHint: {
    fontSize: 14,
    color: colors.card,
    textAlign: 'center',
    opacity: 0.85,
  },

  // Fallback / permission UI
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  infoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.card,
    textAlign: 'center',
  },
  infoSubText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
  },
  permissionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.card,
  },
  closeTextBtn: {
    paddingVertical: 8,
  },
  closeTextBtnLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },
});
