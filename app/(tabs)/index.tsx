import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';

const API_URL = "https://script.google.com/macros/s/AKfycbxe1_meZCJi0kRuL83D_kXxvCBoE1B8VauluPlJQL0fAtoBBo0q5AIFNssSDr5tsOcR/exec";

export default function ScanScreen() {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [name, setName] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const savedName = await AsyncStorage.getItem('user_name');
    if (savedName) {
      setName(savedName);
      setIsRegistered(true);
    }
  }

  const handleRegister = async () => {
    if (name.trim().length < 2) return alert("Enter your name");
    await AsyncStorage.setItem('user_name', name);
    setIsRegistered(true);
  };

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    // Prevent multiple scans at once
    if (scanned || isProcessing) return;
    
    setScanned(true);
    setIsProcessing(true);
    const eventName = result.data;

    try {
      // 1. Check the 12-hour rule
      const checkRes = await fetch(`${API_URL}?action=checkLastScan&name=${encodeURIComponent(name)}&event=${encodeURIComponent(eventName)}`);
      const { lastScan } = await checkRes.json();

      if (lastScan > 0 && (Date.now() - lastScan) < (12 * 60 * 60 * 1000)) {
        alert(`Already scanned "${eventName}" recently!`);
        setIsProcessing(false);
        setTimeout(() => setScanned(false), 2000); // Reset scanner after 2 seconds
        return;
      }

      // 2. Submit the attendance
      const formData = new URLSearchParams();
      formData.append('name', name);
      formData.append('event', eventName);

      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      alert(`Check-in successful for: ${eventName}`);
    } catch (e) {
      alert("Connection error. Please try again.");
    } finally {
      setIsProcessing(false);
      // Wait 3 seconds before allowing another scan to prevent accidental doubles
      setTimeout(() => setScanned(false), 3000);
    }
  };

  // 1. Handle Permissions
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.info}>Camera access is required to scan QR codes.</Text>
        <Button title="Enable Camera" onPress={requestPermission} />
      </View>
    );
  }

  // 2. Handle Initial Registration
  if (!isRegistered) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={{ marginBottom: 10 }}>Please enter your name to start.</Text>
        <TextInput 
          style={styles.input} 
          value={name} 
          onChangeText={setName} 
          placeholder="Name" 
          placeholderTextColor="#999"
        />
        <Button title="Register" onPress={handleRegister} />
      </View>
    );
  }

  // 3. Main Scanner View
  return (
    <View style={styles.container}>
      <Text style={styles.info}>Attendee: <Text style={{ fontWeight: 'bold', color: '#2196F3' }}>{name}</Text></Text>
      
      <View style={styles.cameraContainer}>
        {/* Only mount camera if tab is active (isFocused) */}
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
        {scanned ? "Processing scan..." : "Point at an Event QR Code to Scan"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#f2f2f2' 
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 10 
  },
  input: { 
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    width: '80%', 
    marginBottom: 20, 
    padding: 15, 
    textAlign: 'center',
    fontSize: 16
  },
  info: { 
    fontSize: 20, 
    marginBottom: 30 
  },
  cameraContainer: { 
    width: 300, 
    height: 300, 
    borderRadius: 30, 
    overflow: 'hidden', 
    backgroundColor: '#000', 
    borderWidth: 5, 
    borderColor: '#fff',
    position: 'relative'
  },
  camera: { 
    flex: 1 
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: { 
    marginTop: 25, 
    color: '#888', 
    fontStyle: 'italic',
    fontSize: 14
  }
});