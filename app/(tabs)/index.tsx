import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getUserData, HistoryItem, parseScanResult, submitScan } from '../../components/api';
import { USER_NAME_UPDATED_EVENT } from '../../components/events';
import { getSecurityCredentials } from '../../components/securityHelper';
import {
  CACHE_KEYS,
  getWithExpiry,
  invalidateAttendanceCaches,
  saveWithExpiry,
} from '../../components/storageHelper';
import { PrimaryButton, ToastMessage, ToastType } from '../../components/ui';
import { getVisitRank, VisitRankTheme } from '../../components/visitRanks';

function isValidQrPayload(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 120;
}

type ScannerRankDebugGlobal = typeof globalThis & {
  setScannerRank?: (rank: string | number) => string;
  resetScannerRank?: () => string;
};

const DEBUG_RANK_VISITS: Record<string, number> = {
  stranac: 0,
  srednjoskolac: 1,
  gaijin: 5,
  streetracer: 10,
  challenger: 25,
  han: 50,
  dk: 100,
  dklegend: 100,
};

function RankedOuterFrame({ rank }: { rank: VisitRankTheme }) {
  if (rank.tier === 0) return null;

  return (
    <View style={styles.outerRankDecor} pointerEvents="none">
      <View
        style={[
          styles.outerRankRing,
          {
            borderColor: rank.secondary,
            opacity: 0.28 + rank.tier * 0.07,
          },
        ]}
      />

      {rank.tier >= 2 && (
        <>
          <View
            style={[
              styles.outerSideBlade,
              styles.outerSideBladeLeft,
              { borderColor: rank.primary, backgroundColor: rank.glow },
            ]}
          >
            <View style={[styles.outerSideBladeCore, { backgroundColor: rank.secondary }]} />
          </View>
          <View
            style={[
              styles.outerSideBlade,
              styles.outerSideBladeRight,
              { borderColor: rank.primary, backgroundColor: rank.glow },
            ]}
          >
            <View style={[styles.outerSideBladeCore, { backgroundColor: rank.secondary }]} />
          </View>
        </>
      )}

      {rank.tier >= 3 && (
        <>
          <View
            style={[
              styles.outerShoulder,
              styles.outerShoulderTopLeft,
              { borderColor: rank.primary },
            ]}
          />
          <View
            style={[
              styles.outerShoulder,
              styles.outerShoulderTopRight,
              { borderColor: rank.primary },
            ]}
          />
        </>
      )}

      {rank.tier >= 4 && (
        <>
          <View
            style={[
              styles.outerShoulder,
              styles.outerShoulderBottomLeft,
              { borderColor: rank.secondary },
            ]}
          />
          <View
            style={[
              styles.outerShoulder,
              styles.outerShoulderBottomRight,
              { borderColor: rank.secondary },
            ]}
          />
          <View style={[styles.outerCrestSocket, { borderColor: rank.primary }]}>
            <View style={[styles.outerCrestGem, { backgroundColor: rank.target }]} />
          </View>
        </>
      )}

      {rank.tier >= 5 && (
        <>
          <View
            style={[
              styles.outerSideJewel,
              styles.outerSideJewelLeft,
              { backgroundColor: rank.secondary, borderColor: rank.target },
            ]}
          />
          <View
            style={[
              styles.outerSideJewel,
              styles.outerSideJewelRight,
              { backgroundColor: rank.secondary, borderColor: rank.target },
            ]}
          />
          <View style={[styles.outerCrownHalo, { borderColor: rank.secondary }]} />
        </>
      )}

      {rank.tier >= 6 && (
        <>
          <View style={[styles.outerDkRing, { borderColor: rank.secondary }]} />
          <View
            style={[
              styles.outerDkWing,
              styles.outerDkWingLeft,
              { borderColor: rank.primary, backgroundColor: rank.glow },
            ]}
          />
          <View
            style={[
              styles.outerDkWing,
              styles.outerDkWingRight,
              { borderColor: rank.primary, backgroundColor: rank.glow },
            ]}
          />
          <View
            style={[
              styles.outerDkSpire,
              { backgroundColor: rank.secondary, borderColor: rank.target },
            ]}
          />
        </>
      )}
    </View>
  );
}

function TokyoRankPlate({ rank, userName }: { rank: VisitRankTheme; userName: string }) {
  const plateNumber = `${rank.minVisits} ${rank.code}`;
  const plateOwner = userName.trim() || 'Gost';

  return (
    <View style={styles.tokyoPlateMount} pointerEvents="none">
      <View style={styles.tokyoPlate}>
        <View style={styles.plateInnerBorder} />
        <View style={styles.plateHighlight} />

        <View style={[styles.plateBolt, styles.plateBoltLeft]} />
        <View style={[styles.plateBolt, styles.plateBoltRight]} />

        <View style={styles.plateTopRow}>
          <Text style={styles.plateTopText}>品川 530</Text>
          <Text style={styles.plateOwnerName} numberOfLines={1} ellipsizeMode="tail">
            {plateOwner}
          </Text>
        </View>
        <View style={styles.plateNumberRow}>
          <Text style={styles.plateKana}>さ</Text>
          <Text style={styles.plateNumber}>{plateNumber}</Text>
        </View>
      </View>
    </View>
  );
}

function RankedScannerOverlay({ rank }: { rank: VisitRankTheme }) {
  const hasRankFrame = rank.tier > 0;

  return (
    <View style={styles.rankOverlay} pointerEvents="none">
      {hasRankFrame && (
        <View
          style={[
            styles.innerRankBorder,
            {
              borderColor: rank.secondary,
              opacity: 0.32 + rank.tier * 0.08,
            },
          ]}
        />
      )}

      {rank.tier >= 2 && (
        <>
          <View
            style={[styles.rankCorner, styles.rankCornerTopLeft, { borderColor: rank.target }]}
          />
          <View
            style={[styles.rankCorner, styles.rankCornerTopRight, { borderColor: rank.target }]}
          />
          <View
            style={[styles.rankCorner, styles.rankCornerBottomLeft, { borderColor: rank.target }]}
          />
          <View
            style={[styles.rankCorner, styles.rankCornerBottomRight, { borderColor: rank.target }]}
          />
        </>
      )}

      {rank.tier >= 3 && (
        <>
          <View style={[styles.rankRail, styles.rankRailLeft, { backgroundColor: rank.primary }]} />
          <View
            style={[styles.rankRail, styles.rankRailRight, { backgroundColor: rank.primary }]}
          />
        </>
      )}

      {rank.tier >= 4 && (
        <View style={styles.rankCrownRow}>
          <View style={[styles.rankDiamond, { backgroundColor: rank.secondary }]} />
          <View
            style={[
              styles.rankDiamond,
              styles.rankDiamondMain,
              { backgroundColor: rank.target, borderColor: rank.primary },
            ]}
          />
          <View style={[styles.rankDiamond, { backgroundColor: rank.secondary }]} />
        </View>
      )}

      {rank.tier >= 5 && (
        <>
          <View
            style={[styles.eliteAccent, styles.eliteAccentLeft, { borderColor: rank.secondary }]}
          />
          <View
            style={[styles.eliteAccent, styles.eliteAccentRight, { borderColor: rank.secondary }]}
          />
        </>
      )}

      {rank.tier >= 6 && (
        <View style={styles.dkShineRow}>
          <View style={[styles.dkShine, { backgroundColor: rank.target }]} />
          <View style={[styles.dkShine, styles.dkShineLong, { backgroundColor: rank.secondary }]} />
          <View style={[styles.dkShine, { backgroundColor: rank.target }]} />
        </View>
      )}

      <View style={styles.scannerTargetContainer}>
        <View
          style={[
            styles.targetSquare,
            {
              borderColor: rank.target,
              borderWidth: rank.tier >= 3 ? 4 : 3,
              borderStyle: 'dashed',
            },
          ]}
        />
      </View>
    </View>
  );
}

export default function ScanScreen() {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanLock = useRef(false);
  const rankLoadId = useRef(0);

  const [scanned, setScanned] = useState(false);
  const [name, setName] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState(false);
  const [totalVisits, setTotalVisits] = useState(0);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (scanResetTimer.current) clearTimeout(scanResetTimer.current);
      if (navigationTimer.current) clearTimeout(navigationTimer.current);
    };
  }, []);

  useEffect(() => {
    if (isFocused) loadUser();
  }, [isFocused]);

  useEffect(() => {
    if (Platform.OS !== 'web' || process.env.NODE_ENV !== 'development') return;

    const debugGlobal = globalThis as ScannerRankDebugGlobal;
    const setScannerRank = (rank: string | number) => {
      const normalizedRank = String(rank)
        .toLowerCase()
        .replace(/[\s._-]/g, '');
      const visits =
        typeof rank === 'number' ? Math.max(0, rank) : DEBUG_RANK_VISITS[normalizedRank];

      if (visits === undefined || !Number.isFinite(visits)) {
        return 'Nepoznat rank. Koristi: stranac, srednjoskolac, gaijin, streetracer, challenger, han ili dk.';
      }

      rankLoadId.current += 1;
      setTotalVisits(visits);
      return `Prikazan je ${getVisitRank(visits).label} okvir (${visits} poseta).`;
    };
    const resetScannerRank = () => {
      loadUser();
      return 'Vraćen je stvarni rank korisnika.';
    };

    debugGlobal.setScannerRank = setScannerRank;
    debugGlobal.resetScannerRank = resetScannerRank;

    return () => {
      if (debugGlobal.setScannerRank === setScannerRank) delete debugGlobal.setScannerRank;
      if (debugGlobal.resetScannerRank === resetScannerRank) delete debugGlobal.resetScannerRank;
    };
  }, []);

  const visitRank = getVisitRank(totalVisits);

  const showToast = (message: string, type: ToastType = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  async function loadUser() {
    try {
      const savedName = await AsyncStorage.getItem('user_name');
      if (savedName) {
        setName(savedName);
        setIsRegistered(true);
        loadVisitCount(savedName);
      } else {
        setTotalVisits(0);
      }
    } catch {
      showToast('Ne mogu da učitam korisnika.', 'error');
    }
  }

  async function loadVisitCount(savedName: string) {
    const requestId = ++rankLoadId.current;

    try {
      const cachedHistory = await getWithExpiry<HistoryItem[]>(CACHE_KEYS.history(savedName));
      if (requestId !== rankLoadId.current) return;

      if (cachedHistory) {
        setTotalVisits(cachedHistory.length);
        return;
      }

      const { secret } = await getSecurityCredentials();
      const freshHistory = await getUserData(savedName, secret);
      if (requestId !== rankLoadId.current) return;

      setTotalVisits(freshHistory.length);
      await saveWithExpiry(CACHE_KEYS.history(savedName), freshHistory, 10);
    } catch {
      // Rank decoration is optional; camera access must keep working offline.
    }
  }

  const handleRegister = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      showToast('Unesi ime od najmanje 2 karaktera.', 'error');
      return;
    }

    try {
      Keyboard.dismiss();
      await AsyncStorage.setItem('user_name', trimmedName);
      setName(trimmedName);
      setIsRegistered(true);
      setTotalVisits(0);
      DeviceEventEmitter.emit(USER_NAME_UPDATED_EVENT, trimmedName);
      showToast(`Zdravo, ${trimmedName}!`, 'success');
    } catch {
      showToast('Greška pri čuvanju imena.', 'error');
    }
  };

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    const eventName = result.data.trim();

    if (scanLock.current) return;
    if (!isValidQrPayload(eventName)) {
      showToast('QR kod nije validan.', 'error');
      return;
    }

    scanLock.current = true;
    setScanned(true);
    setIsProcessing(true);

    try {
      let secret: string;
      try {
        ({ secret } = await getSecurityCredentials());
      } catch {
        showToast('Ne mogu da učitam podatke za prijavu. Pokušaj ponovo.', 'error');
        return;
      }

      let resultText: string;
      try {
        resultText = await submitScan(name.trim(), secret, eventName);
      } catch {
        showToast(
          'Odgovor servera nije potvrđen. Proveri istoriju pre ponovnog skeniranja.',
          'error'
        );
        return;
      }

      const scanResult = parseScanResult(resultText);
      if (scanResult.status === 'rejected') {
        showToast(scanResult.message, 'error');
        return;
      }

      const msg =
        scanResult.status === 'checkout' ? `Odjavljen: ${eventName}` : `Prijavljen: ${eventName}`;

      showToast(msg, 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

      invalidateAttendanceCaches(name.trim()).catch(() => {
        showToast('Skeniranje je sačuvano, ali lokalni podaci nisu osveženi.', 'info');
      });

      navigationTimer.current = setTimeout(() => {
        try {
          router.replace('/UserHistory');
        } catch {
          showToast('Skeniranje je sačuvano. Istoriju otvori ručno.', 'info');
        }
      }, 1500);
    } finally {
      setIsProcessing(false);
      scanResetTimer.current = setTimeout(() => {
        scanLock.current = false;
        setScanned(false);
      }, 3000);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.permissionSubtitle}>Proveravam pristup kameri...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionTitle}>Potreban pristup kameri</Text>
        <Text style={styles.permissionSubtitle}>
          {permission.canAskAgain
            ? 'Aplikacija koristi kameru za skeniranje QR kodova na lokacijama.'
            : 'Pristup kameri je blokiran.'}
        </Text>
        {permission.canAskAgain && (
          <PrimaryButton label="Uključi kameru" onPress={requestPermission} />
        )}
      </View>
    );
  }

  if (!isRegistered) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Šmiber</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Tvoje ime..."
          placeholderTextColor="#999"
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={handleRegister}
        />
        <PrimaryButton label="Sačuvaj i nastavi" onPress={handleRegister} />
        {toast && <ToastMessage message={toast.message} type={toast.type} />}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.cameraRankShell,
          {
            shadowColor: visitRank.primary,
            shadowOpacity: visitRank.tier === 0 ? 0 : 0.16 + visitRank.tier * 0.05,
            shadowRadius: 7 + visitRank.tier * 2,
            elevation: visitRank.tier === 0 ? 0 : 4 + visitRank.tier,
          },
        ]}
      >
        {visitRank.tier > 0 && (
          <View style={[styles.rankAura, { backgroundColor: visitRank.glow }]} />
        )}
        <RankedOuterFrame rank={visitRank} />
        <View
          nativeID="ranked-scanner-frame"
          style={[
            styles.cameraContainer,
            {
              borderColor: visitRank.primary,
              borderWidth:
                visitRank.tier >= 6
                  ? 8
                  : visitRank.tier >= 5
                  ? 7
                  : visitRank.tier >= 3
                  ? 6
                  : visitRank.tier >= 2
                  ? 5
                  : 4,
            },
          ]}
        >
          {isFocused ? (
            <CameraView
              style={styles.camera}
              facing="back"
              autofocus={Platform.OS === 'web' ? 'on' : undefined}
              zoom={0.1}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              onCameraReady={() => setCameraError(false)}
              onMountError={() => setCameraError(true)}
            />
          ) : (
            <View style={[styles.camera, { backgroundColor: '#000' }]} />
          )}

          {!cameraError && <RankedScannerOverlay rank={visitRank} />}

          {cameraError && (
            <View style={styles.cameraErrorOverlay}>
              <Text style={styles.cameraErrorText}>
                Kamera ne može da se pokrene. Zatvori druge aplikacije koje koriste kameru ili
                probaj drugi pregledač.
              </Text>
            </View>
          )}

          {isProcessing && (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.overlayText}>Obrada...</Text>
            </View>
          )}
        </View>
        <TokyoRankPlate rank={visitRank} userName={name} />
      </View>

      <Text style={[styles.relaxedText, styles.relaxedTextWithPlate]}>
        {scanned ? 'Šaljem podatke u Šmiber bazu...' : 'Skeniraj QR'}
      </Text>
      <Text style={styles.tinySecureText}>
        <Text style={{ fontSize: 16 }}>🛡️</Text>Sigurnost garantuje Dinčo Vangard
      </Text>
      {toast && <ToastMessage message={toast.message} type={toast.type} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  tinySecureText: {
    textAlign: 'center',
    fontSize: 9,
    color: '#bbb',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    width: '85%',
    marginBottom: 20,
    padding: 18,
    textAlign: 'center',
    fontSize: 18,
    color: '#333',
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  relaxedText: {
    color: '#2196F3',
    marginTop: 15,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 20,
  },
  relaxedTextWithPlate: { marginTop: 38 },
  cameraRankShell: {
    width: '88%',
    maxWidth: 340,
    aspectRatio: 3 / 4,
    borderRadius: 44,
    shadowOffset: { width: 0, height: 6 },
  },
  rankAura: {
    position: 'absolute',
    top: -9,
    right: -9,
    bottom: -9,
    left: -9,
    borderRadius: 49,
  },
  outerRankDecor: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  outerRankRing: {
    position: 'absolute',
    top: -6,
    right: -6,
    bottom: -6,
    left: -6,
    borderRadius: 48,
    borderWidth: 2,
  },
  outerSideBlade: {
    position: 'absolute',
    top: '28%',
    width: 15,
    height: '44%',
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerSideBladeLeft: {
    left: -11,
    borderLeftWidth: 5,
  },
  outerSideBladeRight: {
    right: -11,
    borderRightWidth: 5,
  },
  outerSideBladeCore: {
    width: 3,
    height: '62%',
    borderRadius: 3,
    opacity: 0.86,
  },
  outerShoulder: {
    position: 'absolute',
    width: '32%',
    height: 26,
  },
  outerShoulderTopLeft: {
    top: -11,
    left: 22,
    borderTopWidth: 5,
    borderLeftWidth: 3,
    borderTopLeftRadius: 22,
    transform: [{ rotate: '-4deg' }],
  },
  outerShoulderTopRight: {
    top: -11,
    right: 22,
    borderTopWidth: 5,
    borderRightWidth: 3,
    borderTopRightRadius: 22,
    transform: [{ rotate: '4deg' }],
  },
  outerShoulderBottomLeft: {
    bottom: -11,
    left: 22,
    borderBottomWidth: 5,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 22,
    transform: [{ rotate: '4deg' }],
  },
  outerShoulderBottomRight: {
    right: 22,
    bottom: -11,
    borderRightWidth: 3,
    borderBottomWidth: 5,
    borderBottomRightRadius: 22,
    transform: [{ rotate: '-4deg' }],
  },
  outerCrestSocket: {
    position: 'absolute',
    top: -18,
    left: '50%',
    width: 38,
    height: 26,
    marginLeft: -19,
    borderWidth: 3,
    borderRadius: 8,
    backgroundColor: '#111318',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ skewX: '-10deg' }],
  },
  outerCrestGem: {
    width: 11,
    height: 11,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  outerSideJewel: {
    position: 'absolute',
    top: '48%',
    width: 14,
    height: 14,
    borderWidth: 2,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  outerSideJewelLeft: { left: -16 },
  outerSideJewelRight: { right: -16 },
  outerCrownHalo: {
    position: 'absolute',
    top: -27,
    left: '35%',
    right: '35%',
    height: 24,
    borderTopWidth: 4,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    opacity: 0.85,
  },
  outerDkRing: {
    position: 'absolute',
    top: -14,
    right: -14,
    bottom: -14,
    left: -14,
    borderRadius: 56,
    borderWidth: 3,
    opacity: 0.48,
  },
  outerDkWing: {
    position: 'absolute',
    top: 68,
    width: 42,
    height: 24,
    borderTopWidth: 5,
    borderBottomWidth: 2,
    borderRadius: 8,
  },
  outerDkWingLeft: {
    left: -21,
    transform: [{ rotate: '-24deg' }],
  },
  outerDkWingRight: {
    right: -21,
    transform: [{ rotate: '24deg' }],
  },
  outerDkSpire: {
    position: 'absolute',
    top: -34,
    left: '50%',
    width: 20,
    height: 20,
    marginLeft: -10,
    borderWidth: 3,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  cameraContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: '#000',
    zIndex: 2,
  },
  camera: {
    flex: 1,
    borderRadius: 34,
    overflow: 'hidden',
  },
  rankOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  innerRankBorder: {
    position: 'absolute',
    top: 7,
    right: 7,
    bottom: 7,
    left: 7,
    borderRadius: 30,
    borderWidth: 2,
  },
  scannerTargetContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  targetSquare: {
    width: '58%',
    aspectRatio: 1,
    borderRadius: 20,
    opacity: 0.72,
  },
  rankCorner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderWidth: 0,
    zIndex: 2,
  },
  rankCornerTopLeft: {
    top: 18,
    left: 18,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  rankCornerTopRight: {
    top: 18,
    right: 18,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  rankCornerBottomLeft: {
    bottom: 18,
    left: 18,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  rankCornerBottomRight: {
    right: 18,
    bottom: 18,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 10,
  },
  rankRail: {
    position: 'absolute',
    top: '35%',
    width: 4,
    height: '30%',
    borderRadius: 4,
    opacity: 0.82,
  },
  rankRailLeft: { left: 10 },
  rankRailRight: { right: 10 },
  rankCrownRow: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 3,
  },
  rankDiamond: {
    width: 9,
    height: 9,
    transform: [{ rotate: '45deg' }],
    opacity: 0.88,
  },
  rankDiamondMain: {
    width: 16,
    height: 16,
    borderWidth: 2,
  },
  eliteAccent: {
    position: 'absolute',
    top: 52,
    width: 44,
    height: 20,
    borderTopWidth: 3,
    opacity: 0.95,
  },
  eliteAccentLeft: {
    left: 22,
    borderLeftWidth: 3,
    transform: [{ skewX: '-28deg' }],
  },
  eliteAccentRight: {
    right: 22,
    borderRightWidth: 3,
    transform: [{ skewX: '28deg' }],
  },
  dkShineRow: {
    position: 'absolute',
    top: 82,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dkShine: {
    width: 18,
    height: 2,
    borderRadius: 2,
    opacity: 0.86,
  },
  dkShineLong: { width: 44 },
  tokyoPlateMount: {
    position: 'absolute',
    right: 0,
    bottom: -23,
    left: 0,
    alignItems: 'center',
    zIndex: 4,
  },
  tokyoPlate: {
    position: 'relative',
    width: 210,
    minHeight: 52,
    borderWidth: 2,
    borderColor: '#1C5947',
    borderRadius: 9,
    backgroundColor: '#F4F2E6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.42,
    shadowRadius: 7,
    elevation: 8,
    zIndex: 2,
  },
  plateInnerBorder: {
    position: 'absolute',
    top: 3,
    right: 3,
    bottom: 3,
    left: 3,
    borderWidth: 1,
    borderColor: '#1C5947',
    borderRadius: 6,
    opacity: 0.68,
  },
  plateHighlight: {
    position: 'absolute',
    top: 8,
    right: 25,
    width: 42,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.72)',
    transform: [{ rotate: '-12deg' }],
    zIndex: 3,
  },
  plateBolt: {
    position: 'absolute',
    top: 7,
    width: 7,
    height: 7,
    borderWidth: 1,
    borderColor: '#77776F',
    borderRadius: 4,
    backgroundColor: '#C6C4B8',
    opacity: 0.9,
  },
  plateBoltLeft: { left: 10 },
  plateBoltRight: { right: 10 },
  plateTopRow: {
    width: '72%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  plateTopText: {
    color: '#1C5947',
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  plateOwnerName: {
    flex: 1,
    marginLeft: 9,
    color: '#292D30',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  plateNumberRow: {
    width: '76%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plateKana: {
    color: '#1C5947',
    marginRight: 13,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  plateNumber: {
    color: '#292D30',
    fontSize: 20,
    lineHeight: 23,
    fontWeight: '900',
    letterSpacing: 4,
    textShadowColor: 'rgba(255,255,255,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  cameraErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    zIndex: 3,
  },
  cameraErrorText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  overlayText: {
    color: '#fff',
    marginTop: 10,
  },
});
