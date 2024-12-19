import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from "@react-navigation/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useRouter } from "expo-router"; // Use router for navigation
import CaptureScreen from "./capture";
import AnalysisScreen from "./analyse";
import UsersScreen from "./users";
import ReportsScreen from "./reports";
import TrainScreen from "./train";
import { Ionicons } from "@expo/vector-icons"; // Import Ionicons from expo vector icons

const Drawer = createDrawerNavigator();

function CustomDrawerContent(props: any) {
    const router = useRouter(); // Router for navigation

    return (
        <View style={{ flex: 1 }}>
            {/* Render Drawer Items */}
            <DrawerContentScrollView {...props}>
                <DrawerItemList {...props} />
            </DrawerContentScrollView>

            {/* Logout Footer */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={() => router.push('/')} // Redirect to the login/index screen
                >
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function DrawerLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Drawer.Navigator
                drawerContent={(props) => <CustomDrawerContent {...props} />}
                screenOptions={{
                    drawerStyle: {
                        borderRadius: 0, // No border radius for the drawer sheet
                    },
                    drawerItemStyle: {
                        borderRadius: 8, // Border radius for drawer items
                    },
                    drawerActiveTintColor: "#10b981", // Active tint color
                    drawerInactiveTintColor: "#000", // Inactive tint color
                }}
            >
                {/* Drawer Screens with Icons */}
                <Drawer.Screen
                    name="capture"
                    component={CaptureScreen}
                    options={{
                        drawerIcon: ({ color }) => (
                            <Ionicons name="camera-outline" size={22} color={color} />
                        ),
                    }}
                />
                <Drawer.Screen
                    name="analyse"
                    component={AnalysisScreen}
                    options={{
                        drawerIcon: ({ color }) => (
                            <Ionicons name="bar-chart-outline" size={22} color={color} />
                        ),
                    }}
                />
                <Drawer.Screen
                    name="train"
                    component={TrainScreen}
                    options={{
                        drawerIcon: ({ color }) => (
                            <Ionicons name="toggle-outline" size={22} color={color} />  
                        ),
                    }}
                />
                <Drawer.Screen
                    name="reports"
                    component={ReportsScreen}
                    options={{
                        drawerIcon: ({ color }) => (
                            <Ionicons name="document-text-outline" size={22} color={color} />
                        ),
                    }}
                />
                <Drawer.Screen
                    name="users"
                    component={UsersScreen}
                    options={{
                        drawerIcon: ({ color }) => (
                            <Ionicons name="people-outline" size={22} color={color} />
                        ),
                    }}
                />
            </Drawer.Navigator>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    footer: {
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: "#ccc",
        alignItems: "center",
    },
    logoutButton: {
        padding: 12,
        backgroundColor: "#f44336",
        borderRadius: 8,
        width: "100%",
        alignItems: "center",
    },
    logoutText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 16,
    },
});
