import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";

const STORAGE_KEY = "newlife_user_id";

export default function Settings() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      router.replace("/login");
    } catch (error) {
      Alert.alert("Error", "Logout failed");
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Pressable
        onPress={handleLogout}
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      >
        <Text>Logout</Text>
      </Pressable>
    </View>
  );
}