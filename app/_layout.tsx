import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="main" />
      <Stack.Screen name="manage-members" />
      <Stack.Screen name="add-member" />
      <Stack.Screen name="member-tasks" />
      <Stack.Screen name="create-task" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="calendar" />
      <Stack.Screen name="volunteers" />
      <Stack.Screen name="special-meeting" />
      <Stack.Screen name="plot-calendar" />
      <Stack.Screen name="manage-ministry" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}