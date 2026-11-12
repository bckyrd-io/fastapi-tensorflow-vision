import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router'; // Import useRouter

const RegisterScreen: React.FC = () => {
    const [username, setUsername] = useState<string>('');
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const router = useRouter(); // Use router for navigation


    const submitRegisterForm = async () => {
        console.log("Submitting form with:", { username, email, password }); // Log form data

        if (!username || !email || !password) {
            Toast.show({
                type: 'error',
                text1: 'Registration failed',
                text2: 'Please fill in all the required fields.',
            });
            return;
        }

        try {
            const response = await fetch('http://192.168.13.40:8000/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
            });


            console.log("Response status:", response.status); // Log response status code

            if (response.ok) {
                const data = await response.json();
                console.log("Registration successful, response data:", data); // Log the response data
                Toast.show({
                    type: 'success',
                    text1: 'Registration Successful',
                    text2: 'Please go to the login page.',
                });
                router.push('/'); // Navigate after successful registration
            } else {
                const errorData = await response.json();
                console.log("Registration failed, error data:", errorData); // Log error data
                Toast.show({
                    type: 'error',
                    text1: 'Registration failed',
                    text2: errorData.detail || 'Please try again.',
                });
            }
        } catch (error) {
            console.log("An error occurred during the fetch:", error); // Log the error if any occurs
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

export default RegisterScreen;
