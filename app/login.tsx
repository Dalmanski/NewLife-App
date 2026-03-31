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
  StyleSheet,
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
    if (!name.trim() || !password.trim()) {
      return Alert.alert("Error", "Enter name and password");
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
        return Alert.alert("Error", "Invalid credentials");
      }

      router.replace({ pathname: "/main", params: { id: snap.docs[0].id } });
    } catch (error) {
      Alert.alert("Error", "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.bgCircleTop} />
        <View style={styles.bgCircleBottom} />

        <View style={styles.card}>
          <View style={styles.brandWrap}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>NL</Text>
            </View>
            <Text style={styles.brandTitle}>NewLife Danao</Text>
            <Text style={styles.brandSubtitle}>App Login</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#9AA4B2"
              style={styles.input}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#9AA4B2"
              secureTextEntry
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <Pressable
              onPress={handleLogin}
              style={({ pressed }) => [
                styles.button,
                pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
              ]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </Pressable>
          </View>
        </View>

        <Text style={styles.footer}>Welcome to the NewLife Danao App</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  bgCircleTop: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#DDEBFF",
    top: -70,
    right: -60,
    opacity: 0.9,
  },
  bgCircleBottom: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#E8F4FF",
    bottom: -50,
    left: -50,
    opacity: 0.9,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  brandWrap: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  brandSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#6B7280",
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D7DEE8",
    backgroundColor: "#F9FBFD",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    fontSize: 16,
    color: "#111827",
  },
  button: {
    backgroundColor: "#2563EB",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#2563EB",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    textAlign: "center",
    marginTop: 16,
    color: "#6B7280",
    fontSize: 13,
  },
});