import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  Card,
  MD3LightTheme,
  PaperProvider,
  Text,
  TextInput,
} from "react-native-paper";
import { db } from "../lib/firebaseConfig";

const STORAGE_KEY = "newlife_user_id";

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#2563EB",
    background: "#F4F7FB",
    surface: "#FFFFFF",
  },
};

function LoginScreenContent() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    const checkSavedLogin = async () => {
      try {
        const savedId = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedId) {
          router.replace({ pathname: "/main", params: { id: savedId } });
          return;
        }
      } catch (error) {
      } finally {
        setCheckingSession(false);
      }
    };

    checkSavedLogin();
  }, [router]);

  const handleLogin = async () => {
    if (loading) return;

    const cleanName = name.trim();
    const cleanPassword = password.trim();

    if (!cleanName || !cleanPassword) {
      Alert.alert("Error", "Enter name and password");
      return;
    }

    try {
      setLoading(true);

      const q = query(
        collection(db, "users"),
        where("name", "==", cleanName),
        where("password", "==", cleanPassword)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        Alert.alert("Error", "Invalid credentials");
        return;
      }

      const userId = snap.docs[0].id;
      await AsyncStorage.setItem(STORAGE_KEY, userId);
      router.replace({ pathname: "/main", params: { id: userId } });
    } catch (error) {
      Alert.alert("Error", "Login failed");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F7FB" }}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator animating size="large" color="#2563EB" />
          <Text style={{ marginTop: 10, color: "#64748B" }}>
            Checking session...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F7FB" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 20,
            paddingVertical: 24,
          }}
        >
          <View
            style={{
              position: "absolute",
              right: -64,
              top: -56,
              width: 224,
              height: 224,
              borderRadius: 999,
              backgroundColor: "#DDEBFF",
              opacity: 0.9,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: -64,
              top: 144,
              width: 160,
              height: 160,
              borderRadius: 999,
              backgroundColor: "#E8F4FF",
              opacity: 0.8,
            }}
          />
          <View
            style={{
              position: "absolute",
              right: -40,
              bottom: -64,
              width: 208,
              height: 208,
              borderRadius: 999,
              backgroundColor: "#EAF2FF",
              opacity: 0.9,
            }}
          />

          <Card
            mode="elevated"
            style={{
              borderRadius: 28,
              backgroundColor: "#FFFFFF",
              padding: 8,
            }}
          >
            <Card.Content style={{ padding: 18 }}>
              <View style={{ alignItems: "center", marginBottom: 18 }}>
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 28,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#F3F7FF",
                    marginBottom: 14,
                  }}
                >
                  <Image
                    source={require("../assets/images/NL-icon.jpg")}
                    style={{ width: 86, height: 86 }}
                    resizeMode="contain"
                  />
                </View>

                <Text
                  variant="headlineMedium"
                  style={{
                    fontWeight: "800",
                    color: "#0F172A",
                  }}
                >
                  Welcome Back
                </Text>

                <Text
                  variant="bodyMedium"
                  style={{
                    marginTop: 6,
                    textAlign: "center",
                    color: "#64748B",
                  }}
                >
                  Sign in to continue to the NewLife Danao App
                </Text>
              </View>

              <View style={{ gap: 14 }}>
                <TextInput
                  mode="outlined"
                  label="Nickname"
                  value={name}
                  onChangeText={setName}
                  left={<TextInput.Icon icon="account-outline" />}
                  dense
                  outlineStyle={{ borderRadius: 16 }}
                  contentStyle={{ paddingVertical: 12 }}
                  style={{ backgroundColor: "#F9FBFD" }}
                  activeOutlineColor="#2563EB"
                  outlineColor="#D7DEE8"
                  textColor="#0F172A"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                />

                <TextInput
                  ref={passwordInputRef}
                  mode="outlined"
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  left={<TextInput.Icon icon="lock-outline" />}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? "eye-off-outline" : "eye-outline"}
                      onPress={() => setShowPassword((prev) => !prev)}
                    />
                  }
                  dense
                  outlineStyle={{ borderRadius: 16 }}
                  contentStyle={{ paddingVertical: 12 }}
                  style={{ backgroundColor: "#F9FBFD" }}
                  activeOutlineColor="#2563EB"
                  outlineColor="#D7DEE8"
                  textColor="#0F172A"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />

                <Button
                  mode="contained"
                  onPress={handleLogin}
                  disabled={loading}
                  contentStyle={{ height: 54 }}
                  labelStyle={{ fontSize: 16, fontWeight: "800" }}
                  style={{
                    borderRadius: 16,
                    marginTop: 4,
                  }}
                  icon={({ size, color }) =>
                    loading ? (
                      <ActivityIndicator animating size="small" color={color} />
                    ) : (
                      <Ionicons name="log-in-outline" size={size} color={color} />
                    )
                  }
                >
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </View>
            </Card.Content>
          </Card>

          <Text
            variant="bodySmall"
            style={{
              marginTop: 18,
              textAlign: "center",
              color: "#64748B",
            }}
          >
            © NewLife Danao App
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function Login() {
  return (
    <PaperProvider theme={theme}>
      <LoginScreenContent />
    </PaperProvider>
  );
}