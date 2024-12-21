import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Button, Text, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';

// --- Types ---
type CaptureSettings = {
  times: number;
  intervals: number;
};

type CaptureScreenProps = {};

// --- Component ---
const CaptureScreen: React.FC<CaptureScreenProps> = () => {
  // --- State Variables ---
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [captureSettings, setCaptureSettings] = useState<CaptureSettings | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [capturedCount, setCapturedCount] = useState<number>(0);

  // --- Effects ---
  useEffect(() => {
    if (permission?.granted) {
      fetchCaptureSettings();
    }
  }, [permission]);

  // --- Fetch Capture Settings ---
  const fetchCaptureSettings = async (): Promise<void> => {
    try {
      const response = await fetch('http://localhost:8000/capture-settings?user_id=123');
      if (!response.ok) throw new Error('Failed to fetch capture settings');
      const data: CaptureSettings = await response.json();
      setCaptureSettings(data);
    } catch (error: any) {
      Alert.alert('Error', `Failed to fetch capture settings: ${error.message}`);
    }
  };

  // --- Handlers ---
  const handleCapturePhoto = async (): Promise<void> => {
    if (!permission?.granted) return;

    try {
      const photo = await capturePhoto(); // Placeholder for actual photo capture logic
      await uploadPhoto(photo.uri);
    } catch (error: any) {
      Alert.alert('Error', `Error capturing photo: ${error.message}`);
    }
  };

  // Placeholder method for capturing a photo, replace with actual camera logic
  const capturePhoto = async () => {
    // Placeholder for photo capture logic
    return { uri: 'captured_image.jpg' }; // This should be replaced with actual photo capture method
  };

  const handleAutoCapture = async (): Promise<void> => {
    if (!captureSettings) {
      Alert.alert('Error', 'Invalid capture settings');
      return;
    }

    setIsCapturing(true);
    for (let i = 0; i < captureSettings.times; i++) {
      setTimeout(async () => {
        await handleCapturePhoto();
        setCapturedCount((prev) => prev + 1);
      }, i * captureSettings.intervals * 1000);
    }
    setIsCapturing(false);
  };

  // Updated uploadPhoto method that uses Blob for React Native uploads
  const uploadPhoto = async (uri: string): Promise<void> => {
    try {
      // Read the image file as a base64 string or binary
      const fileInfo = await FileSystem.getInfoAsync(uri);

      if (!fileInfo.exists) {
        throw new Error('File not found');
      }

      const fileUri = fileInfo.uri;

      // Convert the file to a Blob (for example, if using the base64 data):
      const fileBlob = await fetch(fileUri);
      const blob = await fileBlob.blob();

      // Append the Blob and other necessary data to FormData
      const formData = new FormData();
      formData.append('file', blob, 'captured_image.jpg'); // Append file Blob with filename
      formData.append('user_id', '123'); // Replace with dynamic user_id

      // Make the POST request to upload the image
      const response = await fetch('http://localhost:8000/capture', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload the image');
      Alert.alert('Success', 'Image captured and uploaded successfully');
    } catch (error: any) {
      Alert.alert('Error', `Error uploading photo: ${error.message}`);
    }
  };

  const toggleCameraType = (): void => {
    setCameraType((prevType) => (prevType === 'back' ? 'front' : 'back'));
  };

  // --- Render Permission Handling ---
  if (permission === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Requesting camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>No access to camera.</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  // --- Render Component ---
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <CameraView style={styles.camera} facing={cameraType}>
        <View style={styles.controls}>
          {/* <TouchableOpacity onPress={toggleCameraType} style={styles.button}>
            <Text style={styles.buttonText}>Flip Camera</Text>
          </TouchableOpacity> */}
          <TouchableOpacity onPress={handleCapturePhoto} style={styles.button}>
            <Text style={styles.buttonText}>Capture Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleAutoCapture}
            style={[styles.button, isCapturing && styles.disabledButton]}
            disabled={isCapturing}
          >
            <Text style={styles.buttonText}>Start Auto-Capture</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.status}>
          <Text style={styles.text}>Captured {capturedCount} / {captureSettings?.times || 0}</Text>
        </View>
      </CameraView>
    </ScrollView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
    borderRadius: 10,
  },
  controls: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 30,
    width: '100%',
    paddingHorizontal: 20,
  },
  button: {
    padding: 12,
    backgroundColor: '#10b981', // Custom theme color
    borderRadius: 8,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  status: {
    position: 'absolute',
    bottom: 10,
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    color: '#333333',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CaptureScreen;
