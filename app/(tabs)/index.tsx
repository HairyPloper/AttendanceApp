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
import { parseScanResult, submitScan } from '../../components/api';
import { USER_NAME_UPDATED_EVENT } from '../../components/events';
import { getSecurityCredentials } from '../../components/securityHelper';
import { invalidateAttendanceCaches } from '../../components/storageHelper';
import { PrimaryButton, ToastMessage, ToastType } from '../../components/ui';

function isValidQrPayload(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 120;
}

export default function ScanScreen() {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanLock = useRef(false);

  const [scanned, setScanned] = useState(false);
  const [name, setName] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  useEffect(() => {
    loadUser();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (scanResetTimer.current) clearTimeout(scanResetTimer.current);
      if (navigationTimer.current) clearTimeout(navigationTimer.current);
    };
  }, []);

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
      }
    } catch {
      showToast('Ne mogu da učitam korisnika.', 'error');
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
      <View style={styles.cameraContainer}>
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

        {!cameraError && (
          <View style={styles.scannerTargetContainer} pointerEvents="none">
            <View style={styles.targetSquare} />
          </View>
        )}

        {cameraError && (
          <View style={styles.cameraErrorOverlay}>
            <Text style={styles.cameraErrorText}>
              Kamera ne može da se pokrene. Zatvori druge aplikacije koje koriste kameru ili probaj
              drugi pregledač.
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

      <Text style={styles.relaxedText}>
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
  cameraContainer: {
    width: '88%',
    maxWidth: 340,
    aspectRatio: 3 / 4,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#f0f0f0',
    backgroundColor: '#000',
  },
  camera: { flex: 1 },
  scannerTargetContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  targetSquare: {
    width: '58%',
    aspectRatio: 1,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 20,
    borderStyle: 'dashed',
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
