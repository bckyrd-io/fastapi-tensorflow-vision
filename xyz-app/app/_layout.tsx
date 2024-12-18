import { createDrawerNavigator } from "@react-navigation/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import CaptureScreen from "./capture";
import AnalysisScreen from "./analyse";
import UsersScreen from "./users";

const Drawer = createDrawerNavigator();

export default function DrawerLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer.Navigator
        screenOptions={{
          drawerStyle: {
            backgroundColor: "#fff",
            borderRadius: 0, // Removes any curves
          },
          drawerContentContainerStyle: {
            borderRadius: 0, // Ensures no curves on the drawer content container
          },
          drawerItemStyle: {
            borderRadius: 0,
          },
          drawerActiveBackgroundColor: "#eff", // Primary green for selected item
          drawerActiveTintColor: "#10b981", // White text for selected item
          drawerInactiveTintColor: "#000", // Black text for unselected items
          drawerType: "front",
          drawerContentStyle: {
            borderRadius: 0,
          }
        }}
      >
        <Drawer.Screen
          name="Capture"
          component={CaptureScreen}
          options={{ drawerLabel: "Capture" }}
        />
        <Drawer.Screen
          name="Analysis"
          component={AnalysisScreen}
          options={{ drawerLabel: "Analysis" }}
        />
        <Drawer.Screen
          name="Users"
          component={UsersScreen}
          options={{ drawerLabel: "Users" }}
        />
      </Drawer.Navigator>
    </GestureHandlerRootView>
  );
}
