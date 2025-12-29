import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const API_URL = " ";

export default function ScanScreen() {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  
  // App State
  const [scanned, setScanned] = useState(false);
  const [name, setName] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => { 
    loadUser(); 
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  
  async function loadUser() {
    try {
      const savedName = await AsyncStorage.getItem('user_name');
      if (savedName) { 
        setName(savedName); 
        setIsRegistered(true); 
      }
    } catch (e) {
      console.error("Failed to load user", e);
    }
  }

  const handleRegister = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) return showToast("Unesi ime", 'error');
    
    try {
      Keyboard.dismiss();
      await AsyncStorage.setItem('user_name', trimmedName);
      setName(trimmedName);
      setIsRegistered(true);
      showToast(`Dobrodošao/la, ${trimmedName}!`, 'success');
    } catch (e) {
      showToast("Greška pri čuvanju imena", 'error');
    }
  };

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned || isProcessing) return;
    setScanned(true);
    setIsProcessing(true);
    
    // Provide physical feedback that scan was successful
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ name: name.trim(), event: result.data.trim() }),
      });

      const resultText = await response.text();
      
      if (resultText.includes("Checkout") || resultText.includes("Success")) {
        // Clear local caches to force other screens to refresh
        await AsyncStorage.removeItem(`cache_history_${name.trim()}`);
        await AsyncStorage.removeItem("cached_leaderboard_Global Overall");
        
        const msg = resultText.includes("Checkout") 
          ? `Odjavljen: ${result.data}` 
          : `Prijavljen: ${result.data}`;
        showToast(msg, 'success');
      } else {
        showToast(resultText, 'info');
      }
    } catch (e) {
      showToast("Greška u konekciji.", 'error');
    } finally {
      setIsProcessing(false);
      // Short delay before allowing the next scan
      setTimeout(() => setScanned(false), 3000);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionTitle}>Potreban pristup kameri</Text>
        <Text style={styles.permissionSubtitle}>Aplikacija koristi kameru za skeniranje QR kodova na lokacijama.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.buttonText}>Uključi kameru</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isRegistered) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Šmiber</Text>
        {/* <Text style={styles.subtitle}>Unesi ime</Text> */}
        <TextInput 
          style={styles.input} 
          value={name} 
          onChangeText={setName} 
          placeholder="Tvoje ime..." 
          placeholderTextColor="#999"
          autoCapitalize="words"
        />
        <TouchableOpacity style={styles.primaryButton} onPress={handleRegister}>
          <Text style={styles.buttonText}>Sačuvaj i nastavi</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* <Text style={styles.attendeeLabel}>
        Prijavljen kao: <Text style={{ color: '#2196F3', fontWeight: 'bold' }}>{name}</Text>
      </Text> */}
      
      <View style={styles.cameraContainer}>
        {isFocused ? (
          <CameraView 
            style={styles.camera} 
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} 
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
        ) : (
          <View style={[styles.camera, { backgroundColor: '#000' }]} />
        )}

        {isProcessing && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={{color: '#fff', marginTop: 10}}>Obrađujem...</Text>
          </View>
        )}
      </View>

      <Text style={styles.relaxedText}>{scanned ? "Šaljem podatke u Šmiber bazu..." : "Skeniraj QR"}</Text>

      {toast && (
        <View style={[styles.toast, styles[toast.type]]}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#2196F3', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 30 },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee', borderRadius: 12, width: '85%', marginBottom: 20, padding: 18, textAlign: 'center', fontSize: 18, color: '#333' },
  attendeeLabel: { fontSize: 16, marginBottom: 20, color: '#444' },
  cameraContainer: { width: 280, height: 280, borderRadius: 40, overflow: 'hidden', borderWidth: 4, borderColor: '#f0f0f0', backgroundColor: '#000' },
  camera: { flex: 1 },
  hint: { marginTop: 25, color: '#aaa', fontSize: 14, fontWeight: '500' },
  primaryButton: { backgroundColor: '#2196F3', paddingHorizontal: 50, paddingVertical: 16, borderRadius: 30 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  permissionTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  permissionSubtitle: { fontSize: 14, color: '#777', textAlign: 'center', marginBottom: 30, paddingHorizontal: 20 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  toast: { position: 'absolute', bottom: 40, left: 20, right: 20, padding: 16, borderRadius: 15, elevation: 10 },
  success: { backgroundColor: '#4CAF50' },
  error: { backgroundColor: '#F44336' },
  info: { backgroundColor: '#2196F3' },
  toastText: { color: '#fff', fontWeight: '600', textAlign: 'center', fontSize: 15 },
  relaxedText: {
  color: '#2196F3', 
  marginTop: 15, 
  fontSize: 16, 
  fontWeight: '500', 
  textAlign: 'center',
  fontStyle: 'italic', // Italic makes it feel less like a "command"
  paddingHorizontal: 20
},
});