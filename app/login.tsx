import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, Text, Alert } from "react-native";
import { useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebaseConfig";

export default function Login() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!name || !password) return Alert.alert("Error", "Enter name and password");
    try {
      const q = query(collection(db, "users"), where("name", "==", name), where("password", "==", password));
      const snap = await getDocs(q);
      if (snap.empty) return Alert.alert("Error", "Invalid credentials");
      router.replace({ pathname: "/main", params: { id: snap.docs[0].id } });
    } catch {
      Alert.alert("Error", "Login failed");
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20, gap: 12 }}>
      <TextInput value={name} onChangeText={setName} placeholder="Name" style={{ borderWidth: 1, padding: 12 }} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={{ borderWidth: 1, padding: 12 }} />
      <TouchableOpacity onPress={handleLogin} style={{ borderWidth: 1, padding: 12, alignItems: "center" }}>
        <Text>Login</Text>
      </TouchableOpacity>
    </View>
  );
}