import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';

const LoginScreen: React.FC = () => {
    const [username, setUsername] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const router = useRouter(); // Use the router instead of navigation

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
            const response = await fetch('http://192.168.13.40:8000/login', {
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
                router.push('/(drawer)/capture'); // Navigate to the drawer route
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

            <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text style={styles.link}>Register Account?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/help')}>
                <Text style={styles.link}>Help</Text>
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
        padding: 12,
        backgroundColor: '#10b981',
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

export default LoginScreen;
