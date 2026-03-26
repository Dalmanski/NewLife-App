import { useRouter } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function Settings() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <TouchableOpacity onPress={() => router.replace("/login")} style={{ borderWidth: 1, padding: 12 }}>
        <Text>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}