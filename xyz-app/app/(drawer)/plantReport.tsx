import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { DataTable } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

interface PlantDetail {
  timestamp: string;
  growth_stage: string;
  disease: string;
}

const PlantReportScreen: React.FC = ({ route }: any) => {
  const [plantDetails, setPlantDetails] = useState<PlantDetail[]>([]);
  const { plantName } = route.params;

  useEffect(() => {
    fetchPlantDetails();
  }, []);

  const fetchPlantDetails = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/plant_data/${encodeURIComponent(plantName)}`
      );
      if (response.ok) {
        const data = await response.json();
        setPlantDetails(data.identified_plants);
      } else {
        throw new Error('Failed to fetch plant details.');
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load plant details.',
      });
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{`Plant Report: ${plantName}`}</Text>

      {/* Data Table */}
      <View style={styles.tableContainer}>
        <DataTable>
          <DataTable.Header>
            <DataTable.Title>Timestamp</DataTable.Title>
            <DataTable.Title>Stage</DataTable.Title>
            <DataTable.Title>Infection</DataTable.Title>
          </DataTable.Header>

          {plantDetails.map((detail, index) => (
            <DataTable.Row key={index}>
              <DataTable.Cell>{detail.timestamp}</DataTable.Cell>
              <DataTable.Cell>{detail.growth_stage}</DataTable.Cell>
              <DataTable.Cell>{detail.disease}</DataTable.Cell>
            </DataTable.Row>
          ))}
        </DataTable>
      </View>

      <Toast />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  tableContainer: {
    marginTop: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
  },
});

export default PlantReportScreen;
