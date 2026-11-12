import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Linking } from 'react-native';

const HelpScreen = () => {
    const faqs = [
        {
            question: "How do I set up automated schedules for capturing images?",
            image: require('../assets/img/schedule_capture.png'),
            answer: "To set up automated schedules, follow these steps: (**Placeholder for specific instructions**)",
        },
        {
            question: "How do I grant camera permission to the app?",
            image: require('../assets/img/camera_permission.png'),
            answer: "Granting camera permission allows the Research Plant Growth AI to capture images of your plants. (**Placeholder for specific instructions**)",
        },
        {
            question: "How does the system analyze captured images for diseases?",
            image: require('../assets/img/search_predictions.png'),
            answer: "The system utilizes advanced analysis techniques to identify potential diseases or infections by considering factors like leaf discoloration and abnormalities in captured images.",
        },
        {
            question: "How do I generate plant growth reports?",
            image: require('../assets/img/capture_report.png'),
            answer: "The system allows you to generate growth reports with interactive graphs to visualize the predicted plant data captured over time. (**Placeholder for specific instructions**)",
        },
        {
            question: "What does the plant health section display?",
            image: require('../assets/img/plant_health.png'),
            answer: "The plant health section provides information about the overall health of your plants, potentially including details like growth stage or disease detection.",
        },
        {
            question: "What does the application homepage look like?",
            image: require('../assets/img/index_page.png'),
            answer: "The application homepage serves as the starting point for interacting with the Research Plant Growth AI. (**Placeholder for specific functionalities explained**)",
        },
        {
            question: "How do I upload photos to the system?",
            image: require('../assets/img/upload_photo.png'),
            answer: "Uploading photos allows you to manually add images of your plants to the system, potentially for analysis or record-keeping. (**Placeholder for specific instructions**)",
        },
        {
            question: "What is the purpose of the FastAPI Uvicorn process?",
            image: require('../assets/img/fastapi_uvicorn.png'),
            answer: "The FastAPI Uvicorn process is likely responsible for running the backend server of the application. (**Placeholder for specific explanation**)",
        },
    ];

    return (
        <ScrollView style={styles.container}>
            <View style={styles.faq}>
                {faqs.map((faq, index) => (
                    <View key={index} style={styles.question}>
                        <Text style={styles.questionTitle}>{faq.question}</Text>
                        <Image source={faq.image} style={styles.image} />
                        <Text style={styles.answer}>{faq.answer}</Text>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    link: {
        color: '#10b981',
        marginBottom: 20,
        textDecorationLine: 'underline',
    },
    faq: {
        marginTop: 20,
    },
    question: {
        marginBottom: 20,
    },
    questionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    image: {
        width: '100%',
        height: 200,
        resizeMode: 'contain',
        marginBottom: 10,
    },
    answer: {
        fontSize: 14,
        color: '#333',
    },
});

export default HelpScreen;
