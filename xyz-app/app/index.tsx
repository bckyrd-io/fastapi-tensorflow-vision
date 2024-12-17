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

const LoginScreen: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const navigation = useNavigation();

  const submitLoginForm = async () => {
    if (!username || !password) {
      Toast.show({
        type: 'error',
        text1: 'Login failed',
        text2: 'Please fill in both fields.',
      });
      return;
    }

    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await fetch('http://localhost:8000/login', {
        method: 'POST',
        body: formData,
      });

      if (response.status === 200) {
        const userData = await response.json();

        Toast.show({
          type: 'success',
          text1: 'Login Successful',
          text2: `Welcome back, ${userData.user_name}!`,
        });
        navigation.navigate('reports'); // Replace with your target screen
      } else {
        const errorData = await response.json();
        Toast.show({
          type: 'error',
          text1: 'Login failed',
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
      <Text style={styles.title}>Welcome Back!</Text>
      <Text style={styles.subtitle}>Sign in to your account to continue</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter your username"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Enter your password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity onPress={() => navigation.navigate('signup')}>
        <Text style={styles.link}>Register Account?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={submitLoginForm}>
        <Text style={styles.buttonText}>Sign in</Text>
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

export default LoginScreen;
