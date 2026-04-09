import { Ionicons } from "@expo/vector-icons";
import * as NavigationBar from "expo-navigation-bar";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "nativewind";
import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";

const DARK_MODE_KEY = "newlife_dark_mode";

type HeaderMenuAction = (() => void) | null;

type HeaderMenuContextType = {
  setMenuAction: Dispatch<SetStateAction<HeaderMenuAction>>;
};

export const HeaderMenuContext = createContext<HeaderMenuContextType>({
  setMenuAction: () => {},
});

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [menuAction, setMenuAction] = useState<HeaderMenuAction>(null);
  const { colorScheme, setColorScheme } = useColorScheme();

  useEffect(() => {
    const loadDarkMode = async () => {
      try {
        const darkMode = await AsyncStorage.getItem(DARK_MODE_KEY);
        if (darkMode === "dark" || darkMode === "light") {
          setColorScheme(darkMode);
        }
      } catch (error) {
        console.error("Error loading dark mode preference:", error);
      }
    };
    loadDarkMode();
  }, [setColorScheme]);

  useEffect(() => {
    const hideNav = async () => {
      if (Platform.OS === "android") {
        await NavigationBar.setVisibilityAsync("hidden");
      }
    };
    hideNav();
  }, []);

  const showAppHeader = pathname !== "/login" && pathname !== "/" && pathname !== "";
  const isMain = pathname === "/main";

  const headerValue = useMemo(
    () => ({
      setMenuAction,
    }),
    []
  );

  const handleLeftPress = () => {
    if (isMain) {
      menuAction?.();
      return;
    }
    router.back();
  };

  const handleSettings = () => {
    router.push("/settings" as never);
  };

  return (
    <GestureHandlerRootView className="flex-1">
      <HeaderMenuContext.Provider value={headerValue}>
        <StatusBar
          style={colorScheme === "dark" ? "light" : "dark"}
          backgroundColor={colorScheme === "dark" ? "#111827" : "#ffffff"}
          translucent={false}
        />
        <SafeAreaView className="flex-1 bg-gray-100 dark:bg-gray-950">
          {showAppHeader ? (
            <View
              className="flex-row items-center justify-between bg-white dark:bg-gray-900 px-4 border-b border-gray-200 dark:border-gray-800 z-50"
              style={{
                height: 60,
                elevation: 12,
              }}
            >
              <View className="flex-row items-center">
                <Pressable onPress={handleLeftPress} className="h-10 w-10 items-center justify-center">
                  <Ionicons
                    name={isMain ? "menu-outline" : "chevron-back-outline"}
                    size={28}
                    color={colorScheme === "dark" ? "#F3F4F6" : "#111827"}
                  />
                </Pressable>

                <View className="ml-0.5 flex-row items-baseline">
                  <Text className="text-[28px] font-extrabold leading-[28px] text-gray-900 dark:text-white">
                    NewLife
                  </Text>
                  <Text className="ml-1 text-sm font-normal leading-[14px] text-gray-900 dark:text-gray-300">
                    Danao
                  </Text>
                </View>
              </View>

              <Pressable onPress={handleSettings} className="h-10 w-10 items-center justify-center">
                <Ionicons
                  name="ellipsis-vertical"
                  size={28}
                  color={colorScheme === "dark" ? "#F3F4F6" : "#111827"}
                />
              </Pressable>
            </View>
          ) : null}

          <View className="flex-1 bg-gray-100 dark:bg-gray-950">
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </SafeAreaView>
      </HeaderMenuContext.Provider>
    </GestureHandlerRootView>
  );
}