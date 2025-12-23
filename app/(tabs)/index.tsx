import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_URL = "https://script.google.com/macros/s/AKfycbxe1_meZCJi0kRuL83D_kXxvCBoE1B8VauluPlJQL0fAtoBBo0q5AIFNssSDr5tsOcR/exec";

export default function ScanScreen() {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
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
    if (trimmedName.length < 2) return showToast("Unesi validno ime", 'error');
    
    try {
      Keyboard.dismiss();
      await AsyncStorage.setItem('user_name', trimmedName);
      // We set local state so the UI switches to camera immediately
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
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ name: name.trim(), event: result.data.trim() }),
      });

      const resultText = await response.text();
      
      if (resultText.includes("Checkout")) {
        showToast(`Odjavljen: ${result.data}`, 'success');
      } else if (resultText.includes("Success")) {
        showToast(`Prijavljen: ${result.data}`, 'success');
      } else {
        showToast(resultText, 'info');
      }
    } catch (e) {
      showToast("Greška u konekciji.", 'error');
    } finally {
      setIsProcessing(false);
      // Cooldown to prevent double scans
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
        <Text style={styles.subtitle}>Unesi svoje ime da započneš</Text>
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
      <Text style={styles.attendeeLabel}>Prijavljeni ste kao: <Text style={{ color: '#2196F3', fontWeight: 'bold' }}>{name}</Text></Text>
      
      <View style={styles.cameraContainer}>
        {isFocused ? (
          <CameraView 
            style={styles.camera} 
            facing={Platform.OS === 'web' ? undefined : 'back'} 
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} 
          />
        ) : (
          <View style={[styles.camera, { backgroundColor: '#000' }]} />
        )}
        {isProcessing && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={{color: '#fff', marginTop: 10}}>Slanje podataka...</Text>
          </View>
        )}
      </View>

      <Text style={styles.hint}>{scanned ? "Obrađujem..." : "Skeniraj QR kod na lokaciji"}</Text>

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
  primaryButton: { backgroundColor: '#2196F3', paddingHorizontal: 50, paddingVertical: 16, borderRadius: 30, ...Platform.select({web:{boxShadow:'0px 4px 10px rgba(0,0,0,0.2)'},default:{elevation:3}}) },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  permissionTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  permissionSubtitle: { fontSize: 14, color: '#777', textAlign: 'center', marginBottom: 30, paddingHorizontal: 20 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  toast: { position: 'absolute', bottom: 40, left: 20, right: 20, padding: 16, borderRadius: 15, ...Platform.select({web:{boxShadow:'0px 4px 10px rgba(0,0,0,0.3)'},default:{elevation:10}}) },
  success: { backgroundColor: '#4CAF50' },
  error: { backgroundColor: '#F44336' },
  info: { backgroundColor: '#2196F3' },
  toastText: { color: '#fff', fontWeight: '600', textAlign: 'center', fontSize: 15 }
});