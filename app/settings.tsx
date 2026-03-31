import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function Settings() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Pressable onPress={() => router.replace("/login")} style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}>
        <Text>Logout</Text>
      </Pressable>
    </View>
  );
}