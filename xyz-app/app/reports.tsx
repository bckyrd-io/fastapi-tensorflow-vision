import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface PlantData {
  day: string;
  plant_count: number;
}

const ReportsScreen: React.FC = () => {
  const [chartData, setChartData] = useState<PlantData[]>([]);
  const [plantList, setPlantList] = useState<string[]>([]);
  const navigation = useNavigation();
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    fetchChartData();
    fetchPlantList();
  }, []);

  const fetchChartData = async () => {
    try {
      const response = await fetch('http://localhost:8000/captured_data/1');
      if (response.ok) {
        const data = await response.json();
        setChartData(data.plants_per_day);
      } else {
        throw new Error('Failed to fetch chart data.');
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load chart data.',
      });
    }
  };

  const fetchPlantList = async () => {
    try {
      const response = await fetch('http://localhost:8000/captured_data/1');
      if (response.ok) {
        const data = await response.json();
        setPlantList(data.all_plant_names);
      } else {
        throw new Error('Failed to fetch plant list.');
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load plant list.',
      });
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Reports</Text>

      {/* Bar Chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Plant Count Over Time</Text>
        <BarChart
          data={{
            labels: chartData.map((item) => item.day),
            datasets: [
              {
                data: chartData.map((item) => item.plant_count),
              },
            ],
          }}
          width={screenWidth - 32}
          height={220}
          yAxisLabel=""
          yAxisSuffix=" plants"
          chartConfig={chartConfig}
          verticalLabelRotation={30}
          showBarTops={false}
          fromZero
        />
      </View>

      {/* Plant List */}
      <View style={styles.plantListContainer}>
        <Text style={styles.subTitle}>Identified Plants</Text>
        <FlatList
          data={plantList}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listItem}
              onPress={() =>
                navigation.navigate('PlantReportScreen', { plantName: item })
              }
            >
              <Text style={styles.listItemText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <Toast />
    </ScrollView>
  );
};

const chartConfig = {
  backgroundColor: '#eafbea',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#eafbea',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(75, 222, 151, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '6',
    strokeWidth: '2',
    stroke: '#10b981',
  },
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
    marginBottom: 10,
  },
  chartContainer: {
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#10b981',
  },
  plantListContainer: {
    flex: 1,
    marginTop: 10,
  },
  subTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  listItem: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    marginVertical: 5,
    borderRadius: 8,
    borderColor: '#ddd',
    borderWidth: 1,
  },
  listItemText: {
    fontSize: 16,
    color: '#333',
  },
});

export default ReportsScreen;
