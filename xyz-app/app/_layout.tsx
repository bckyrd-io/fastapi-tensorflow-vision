import { Stack } from "expo-router";

export default function RootLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{ title: "Sign Up" }} />
            <Stack.Screen name="help" options={{ title: "Help" }} />
            <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        </Stack>
    );
}
{ }