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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { submitScan } from '../../components/api';
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

  const [scanned, setScanned] = useState(false);
  const [name, setName] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  useEffect(() => {
    loadUser();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
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

    if (scanned || isProcessing) return;
    if (!isValidQrPayload(eventName)) {
      showToast('QR kod nije validan.', 'error');
      setScanned(false);
      return;
    }

    setScanned(true);
    setIsProcessing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

    try {
      const { secret } = await getSecurityCredentials();
      const resultText = await submitScan(name.trim(), secret, eventName);

      if (resultText.includes('Checkout') || resultText.includes('Success')) {
        await invalidateAttendanceCaches(name.trim());

        const msg = resultText.includes('Checkout')
          ? `Odjavljen: ${eventName}`
          : `Prijavljen: ${eventName}`;

        showToast(msg, 'success');
        setTimeout(() => {
          router.replace('/UserHistory');
        }, 1500);
      } else {
        showToast(resultText || 'Server nije vratio status.', 'info');
      }
    } catch {
      showToast('Greška u konekciji. Proveri internet i pokušaj ponovo.', 'error');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setScanned(false), 3000);
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
          Aplikacija koristi kameru za skeniranje QR kodova na lokacijama.
        </Text>
        <PrimaryButton label="Uključi kameru" onPress={requestPermission} />
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
            autofocus="on"
            enableTorch={torchOn}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            zoom={0.1}
          >
            <View style={styles.scannerTargetContainer}>
              <View style={styles.targetSquare} />
            </View>
          </CameraView>
        ) : (
          <View style={[styles.camera, { backgroundColor: '#000' }]} />
        )}

        {isProcessing && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.overlayText}>Obrada...</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.torchButton, torchOn && styles.torchButtonActive]}
        onPress={() => setTorchOn((current) => !current)}
      >
        <Text style={[styles.torchButtonText, torchOn && styles.torchButtonTextActive]}>
          {torchOn ? 'Lampa uključena' : 'Uključi lampu'}
        </Text>
      </TouchableOpacity>

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
    width: 300,
    height: 300,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#f0f0f0',
    backgroundColor: '#000',
  },
  camera: { flex: 1 },
  scannerTargetContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  targetSquare: {
    width: 100,
    height: 100,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 20,
    borderStyle: 'dashed',
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
  torchButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D0E4FF',
    backgroundColor: '#F0F7FF',
  },
  torchButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  torchButtonText: {
    color: '#2196F3',
    fontWeight: '800',
    fontSize: 13,
  },
  torchButtonTextActive: {
    color: '#fff',
  },
});
