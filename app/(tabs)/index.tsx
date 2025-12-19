import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_URL = "https://script.google.com/macros/s/AKfycbxe1_meZCJi0kRuL83D_kXxvCBoE1B8VauluPlJQL0fAtoBBo0q5AIFNssSDr5tsOcR/exec";

// --- Local Font Mapping for Icons ---
const Glyphs = {
  camera: '\uf030',
  check: '\uf058',
  error: '\uf06a',
  info: '\uf05a',
};

function LocalIcon({ name, color, size = 28 }: { name: keyof typeof Glyphs; color: string; size?: number }) {
  return (
    <Text style={{ fontFamily: 'MyFontAwesome', color, fontSize: size }}>
      {Glyphs[name]}
    </Text>
  );
}

export default function ScanScreen() {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [name, setName] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  async function loadUser() {
    const savedName = await AsyncStorage.getItem('user_name');
    if (savedName) {
      setName(savedName);
      setIsRegistered(true);
    }
  }

  const handleRegister = async () => {
    if (name.trim().length < 2) return showToast("Enter your name", 'error');
    await AsyncStorage.setItem('user_name', name.trim());
    setIsRegistered(true);
  };

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned || isProcessing) return;
    
    setScanned(true);
    setIsProcessing(true);
    const eventName = result.data;

    try {
      // We send a POST request. The Google Script (doPost) handles 
      // the 12h logic to decide between Check-in or Check-out update.
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', 
        },
        body: JSON.stringify({
          name: name.trim(),
          event: eventName.trim(),
        }),
      });

      const resultText = await response.text();
      //Check-out recorded
      //Check-in successful
      // Handling response messages from your Google Script
      if (resultText.includes("Checkout")) {
        showToast(`Ajde idite si: ${eventName}`, 'success');
      } else if (resultText.includes("Success")) {
        showToast(`Check-in successful: ${eventName}`, 'success');
      } else {
        showToast(resultText, 'info');
      }

    } catch (e) {
      console.error("Scan Error:", e);
      showToast("Connection error. Try again.", 'error');
    } finally {
      setIsProcessing(false);
      // Wait 3 seconds before allowing another scan to avoid duplicates
      setTimeout(() => setScanned(false), 3000);
    }
  };

  // 1. Camera Permission View
  if (!permission?.granted) {
    return (
      <View style={styles.centered}>
        <LocalIcon name="camera" color="#ccc" size={80} />
        <Text style={styles.permissionTitle}>Camera Access</Text>
        <Text style={styles.permissionSubtitle}>
          za skeniranje QR kodova.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.buttonText}>Uključi kameru</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 2. Initial Registration View
  if (!isRegistered) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Zdravo!</Text>
        <Text style={styles.registrationSubtitle}>Unesi ime.</Text>
        <TextInput 
          style={styles.input} 
          value={name} 
          onChangeText={setName} 
          placeholder="Your Name" 
          placeholderTextColor="#999"
          autoCapitalize="words"
        />
        <TouchableOpacity style={styles.primaryButton} onPress={handleRegister}>
          <Text style={styles.buttonText}>Skeniraj</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 3. Main Scanner View
  return (
    <View style={styles.container}>
      <Text style={styles.attendeeLabel}>
        Šmiber: <Text style={{ fontWeight: 'bold', color: '#2196F3' }}>{name}</Text>
      </Text>
      
      <View style={styles.cameraContainer}>
        {isFocused ? (
          <CameraView
            style={styles.camera}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
        ) : (
          <View style={[styles.camera, { backgroundColor: '#000' }]} />
        )}
        
        {isProcessing && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={{ color: '#fff', marginTop: 10 }}>Processing...</Text>
          </View>
        )}
      </View>

      <Text style={styles.hint}>
        {scanned ? "Processing..." : "Skeniraj QR kod"}
      </Text>

      {/* --- Toast Notification Overlay --- */}
      {toast && (
        <View style={[styles.toast, styles[toast.type]]}>
          <LocalIcon 
            name={toast.type === 'success' ? 'check' : toast.type === 'error' ? 'error' : 'info'} 
            color="#fff" 
            size={20} 
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: '#fff' },
  
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  registrationSubtitle: { fontSize: 16, color: '#666', marginBottom: 25, textAlign: 'center' },
  input: { 
    backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee', borderRadius: 12, 
    width: '85%', marginBottom: 20, padding: 18, textAlign: 'center', fontSize: 18, color: '#333'
  },

  attendeeLabel: { fontSize: 18, marginBottom: 20, color: '#444' },
  cameraContainer: { 
    width: 280, height: 280, borderRadius: 40, overflow: 'hidden', 
    backgroundColor: '#000', borderWidth: 4, borderColor: '#f0f0f0' 
  },
  camera: { flex: 1 },
  hint: { marginTop: 25, color: '#aaa', fontSize: 14, textAlign: 'center' },

  primaryButton: { backgroundColor: '#2196F3', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30, elevation: 2 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  permissionTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 20, color: '#333' },
  permissionSubtitle: { textAlign: 'center', fontSize: 16, color: '#777', marginVertical: 15, lineHeight: 22 },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  
  toast: {
    position: 'absolute', bottom: 40, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5
  },
  success: { backgroundColor: '#4CAF50' },
  error: { backgroundColor: '#F44336' },
  info: { backgroundColor: '#2196F3' },
  toastText: { color: '#fff', fontWeight: '600', marginLeft: 12, fontSize: 15, flex: 1 }
});