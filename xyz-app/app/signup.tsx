import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';

const RegisterScreen: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const navigation = useNavigation();

  const submitRegisterForm = async () => {
    if (!username || !email || !password) {
      Toast.show({
        type: 'error',
        text1: 'Registration failed',
        text2: 'Please fill in all the required fields.',
      });
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: 'Registration Successful',
          text2: 'Please go to the login page.',
        });
        navigation.navigate('index');
      } else {
        const errorData = await response.json();
        Toast.show({
          type: 'error',
          text1: 'Registration failed',
          text2: errorData.detail || 'Please try again.',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'An error occurred. Please try again later.',
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Get Started</Text>
      <Text style={styles.subtitle}>Start creating the best research on plant growth</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter your username"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Enter your password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity onPress={() => navigation.navigate('index')}>
        <Text style={styles.link}>Login?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={submitRegisterForm}>
        <Text style={styles.buttonText}>Register</Text>
      </TouchableOpacity>

      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  link: {
    color: '#10b981',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#10b981',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default RegisterScreen;
