import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function Feature({ title }: { title: string }) {
  const router = useRouter();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>{title}</Text>
      <Pressable onPress={() => router.back()} style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}>
        <Text>Back</Text>
      </Pressable>
    </View>
  );
}