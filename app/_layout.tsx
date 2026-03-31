import { MaterialIcons } from "@expo/vector-icons";
import * as NavigationBar from "expo-navigation-bar";
import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import {
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const hideNav = async () => {
      if (Platform.OS === "android") {
        await NavigationBar.setVisibilityAsync("hidden");
      }
    };
    hideNav();
  }, []);

  const showAppHeader =
    pathname !== "/login" &&
    pathname !== "/main" &&
    pathname !== "/" &&
    pathname !== "";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        {showAppHeader ? (
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <MaterialIcons name="arrow-back" size={28} color="#111827" />
            </Pressable>

            <Text style={styles.title}>NewLife Danao</Text>

            <Pressable onPress={() => router.push("/settings" as never)} style={styles.iconBtn}>
              <MaterialIcons name="settings" size={28} color="#111827" />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.page}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  topBar: {
    height: 60,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    zIndex: 50,
    elevation: 12,
  },
  iconBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  page: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
});