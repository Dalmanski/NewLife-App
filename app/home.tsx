import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

export default function Main() {
  const router = useRouter();

  const logout = () => {
    router.replace("/login");
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 12 }}>
      <Text>Hello World</Text>

      <TouchableOpacity
        onPress={logout}
        style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
      >
        <Text>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}