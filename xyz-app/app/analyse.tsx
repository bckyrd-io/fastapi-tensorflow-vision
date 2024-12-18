import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons'; // Icon library for mobile

// Define the custom theme green color
const primaryGreen = '#10b981'; // Custom theme color

const GrowthAnalysisScreen = () => {
  const [growthData, setGrowthData] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>('12345'); // Replace with actual user ID logic

  // Fetch growth analysis data
  useEffect(() => {
    fetch(`http://localhost:8000/growth_analysis/${encodeURIComponent(userId)}`)
      .then((response) => response.json())
      .then((data) => {
        setGrowthData(data.growth_analysis);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
      });
  }, [userId]);

  // Handle submission to ResearchHub
  const handleSubmit = (plantName: string, growthStage: string, predictionId: string) => {
    const topic = `${plantName} - ${growthStage}`;
    Alert.alert(
      "Are you sure?",
      "Do you want to submit this data?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "OK",
          onPress: () => {
            fetch(`http://localhost:8000/research_hub/?user_id=${userId}&topic=${encodeURIComponent(topic)}&image_prediction_id=${predictionId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({}),
            })
              .then(response => {
                if (response.ok) {
                  Alert.alert("Submit successful", "", [{ text: "OK" }]);
                } else {
                  Alert.alert("Failed to submit", "", [{ text: "OK" }]);
                }
              })
              .catch(error => {
                Alert.alert("Error", error.message || "Please try again.");
              });
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Growth Analysis</Text>
      <ScrollView style={styles.cardContainer}>
        {growthData.map((entry, index) => {
          const { plant_name, unique_stage_count, prediction_id } = entry;

          return (
            <TouchableOpacity
              key={index}
              style={styles.card}
              onPress={() => handleSubmit(plant_name, 'Growth Stage', prediction_id)}
            >
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{plant_name}</Text>
                <Text style={styles.cardSubtitle}>View Stages</Text>
              </View>
              <Text style={styles.cardCount}>{unique_stage_count}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Custom Submit Button */}
      <TouchableOpacity style={styles.submitButton}>
        <Text style={styles.submitButtonText}>Submit Analysis</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  cardContainer: {
    flex: 1,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#f9f9f9',
    marginBottom: 20,
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#777',
  },
  cardCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: primaryGreen, // Apply the custom primary green color here
  },
  submitButton: {
    backgroundColor: primaryGreen, // Apply the custom primary green color here
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default GrowthAnalysisScreen;
