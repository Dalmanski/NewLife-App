import { useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { db } from "../lib/firebaseConfig";

export default function Login() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;

    if (!name.trim() || !password.trim()) {
      Alert.alert("Error", "Enter name and password");
      return;
    }

    try {
      setLoading(true);

      const q = query(
        collection(db, "users"),
        where("name", "==", name.trim()),
        where("password", "==", password.trim())
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        Alert.alert("Error", "Invalid credentials");
        return;
      }

      router.replace({ pathname: "/main", params: { id: snap.docs[0].id } });
    } catch (error) {
      Alert.alert("Error", "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F4F7FB]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-center px-5"
      >
        <View className="absolute -right-14 -top-16 h-56 w-56 rounded-full bg-[#DDEBFF] opacity-90" />
        <View className="absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-[#E8F4FF] opacity-90" />

        <View className="rounded-[24px] bg-white p-6 shadow-lg shadow-black/10">
          <View className="mb-6 items-center">
            <View className="mb-3 h-[72px] w-[72px] items-center justify-center rounded-full bg-blue-600">
              <Text className="text-[22px] font-extrabold tracking-[1px] text-white">
                NL
              </Text>
            </View>
            <Text className="text-2xl font-extrabold text-gray-900">
              NewLife Danao
            </Text>
            <Text className="mt-1.5 text-sm text-gray-500">App Login</Text>
          </View>

          <View className="gap-3">
            <View>
              <Text className="mb-2 text-sm font-semibold text-gray-700">
                Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor="#9AA4B2"
                className="rounded-[14px] border border-[#D7DEE8] bg-[#F9FBFD] px-4 py-[14px] text-base text-gray-900"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                returnKeyType="next"
              />
            </View>

            <View>
              <Text className="mb-2 text-sm font-semibold text-gray-700">
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#9AA4B2"
                secureTextEntry
                className="rounded-[14px] border border-[#D7DEE8] bg-[#F9FBFD] px-4 py-[14px] text-base text-gray-900"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              className="mt-2 items-center justify-center rounded-[14px] bg-blue-600 py-[15px] shadow-md shadow-blue-600/25 active:scale-[0.99] disabled:opacity-70"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-bold text-white">Login</Text>
              )}
            </Pressable>
          </View>
        </View>

        <Text className="mt-4 text-center text-[13px] text-gray-500">
          Welcome to the NewLife Danao App
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}