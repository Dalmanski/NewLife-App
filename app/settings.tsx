import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { db } from "@/lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

const STORAGE_KEY = "newlife_user_id";
const DARK_MODE_KEY = "newlife_dark_mode";

export default function Settings() {
  const router = useRouter();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const [userData, setUserData] = useState<{
    name?: string;
    email?: string;
    role?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userId = await AsyncStorage.getItem(STORAGE_KEY);
        if (userId) {
          const userDocRef = doc(db, "users", userId);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setUserData(userDocSnap.data() as any);
          }
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadUserData();
  }, []);

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", onPress: () => {} },
      {
        text: "Logout",
        onPress: async () => {
          try {
            await AsyncStorage.removeItem(STORAGE_KEY);
            router.replace("/login");
          } catch (error) {
            Alert.alert("Error", "Logout failed");
          }
        },
      },
    ]);
  };

  const handleDarkModeToggle = async () => {
    try {
      toggleColorScheme();
      const newMode = colorScheme === "dark" ? "light" : "dark";
      await AsyncStorage.setItem(DARK_MODE_KEY, newMode);
    } catch (error) {
      Alert.alert("Error", "Failed to toggle dark mode");
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-gray-900"
      showsVerticalScrollIndicator={false}
    >
      <View className="px-6 py-8">
        {/* Account Information Section */}
        <View className="mb-8">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Account Settings
          </Text>

          <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-4">
            <View className="flex-row items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-blue-500 dark:bg-blue-600 items-center justify-center mr-4">
                <MaterialIcons name="person" size={32} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                  {userData?.name || "User"}
                </Text>
                <Text className="text-sm text-gray-600 dark:text-gray-400">
                  {userData?.email || "email@example.com"}
                </Text>
              </View>
            </View>

            {userData?.role && (
              <View className="flex-row items-center border-t border-gray-200 dark:border-gray-700 pt-4">
                <MaterialIcons
                  name="badge"
                  size={20}
                  color={colorScheme === "dark" ? "#9CA3AF" : "#6B7280"}
                />
                <Text className="ml-3 font-medium text-gray-700 dark:text-gray-300">
                  Role: {userData.role}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Dark Mode Switch */}
        <View className="mb-8">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Appearance
          </Text>

          <Pressable
            onPress={handleDarkModeToggle}
            className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex-row items-center justify-between border border-gray-200 dark:border-gray-700"
          >
            <View className="flex-row items-center">
              <MaterialCommunityIcons
                name={colorScheme === "dark" ? "moon-waning-crescent" : "white-balance-sunny"}
                size={24}
                color={colorScheme === "dark" ? "#FBBF24" : "#F59E0B"}
              />
              <Text className="ml-3 text-base font-medium text-gray-900 dark:text-white">
                Dark Mode
              </Text>
            </View>
            <View
              className={`w-12 h-7 rounded-full items-center justify-center ${
                colorScheme === "dark" ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <View
                className={`w-6 h-6 rounded-full bg-white ${
                  colorScheme === "dark" ? "ml-2.5" : "-ml-2.5"
                }`}
              />
            </View>
          </Pressable>
        </View>

        {/* Logout Button */}
        <View>
          <Pressable
            onPress={handleLogout}
            className="bg-red-500 dark:bg-red-600 rounded-lg p-4 flex-row items-center justify-center border border-red-600 dark:border-red-700"
          >
            <MaterialIcons name="logout" size={20} color="white" />
            <Text className="ml-2 text-base font-semibold text-white">
              Logout
            </Text>
          </Pressable>
        </View>

        <Text className="text-xs text-gray-400 dark:text-gray-600 text-center mt-8">
          v1.0.0
        </Text>
      </View>
    </ScrollView>
  );
}