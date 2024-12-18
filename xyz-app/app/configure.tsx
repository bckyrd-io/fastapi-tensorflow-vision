import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';

// Helper function to simulate getting user ID (replace with actual logic)
const getUserId = () => '123';

const ScheduleCaptureScreen: React.FC = () => {
  const [intervals, setIntervals] = useState<string>('');
  const [times, setTimes] = useState<string>('');

  // Function to handle form submission and send data to the backend
  const handleScheduleCapture = async () => {
    const userId = getUserId();

    // Ensure intervals and times are valid numbers
    const intervalValue = parseInt(intervals);
    const timesValue = parseInt(times);

    if (isNaN(intervalValue) || isNaN(timesValue)) {
      Alert.alert('Error', 'Please enter valid numbers for intervals and times');
      return;
    }

    const formData = {
      intervals: intervalValue,
      times: timesValue,
      user_id: userId,
    };

    try {
      const response = await fetch('http://localhost:8000/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        Alert.alert('Success', 'Capture schedule set successfully!');
      } else {
        Alert.alert('Error', 'Failed to set capture schedule');
      }
    } catch (error:any) {
      Alert.alert('Error', 'Error sending form data: ' + (error?.message || 'Please try again.'));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Schedule Capture</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Intervals in seconds (e.g. 5)"
          value={intervals}
          onChangeText={setIntervals}
          keyboardType="numeric"
          maxLength={2}
        />
        <TextInput
          style={styles.input}
          placeholder="Times (e.g. 2)"
          value={times}
          onChangeText={setTimes}
          keyboardType="numeric"
          maxLength={2}
        />

        <TouchableOpacity style={styles.button} onPress={handleScheduleCapture}>
          <Text style={styles.buttonText}>Set Schedule</Text>
        </TouchableOpacity>
      </View>

      {/* You can add additional content here if needed */}
    </ScrollView>
  );
};

// Styles for the page
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  form: {
    marginVertical: 20,
  },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 10,
    fontSize: 16,
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
});

export default ScheduleCaptureScreen;
