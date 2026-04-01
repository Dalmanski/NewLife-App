import { MaterialIcons } from "@expo/vector-icons";
import * as NavigationBar from "expo-navigation-bar";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
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
  SafeAreaView,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";

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
        <StatusBar style="dark" backgroundColor="#ffffff" translucent={false} />
        <SafeAreaView className="flex-1 bg-gray-100">
          {showAppHeader ? (
            <View
              className="flex-row items-center justify-between bg-white px-4 border-b border-gray-200 z-50"
              style={{
                height:
                  60 +
                  (Platform.OS === "android" ? RNStatusBar.currentHeight ?? 0 : 0),
                paddingTop:
                  Platform.OS === "android" ? RNStatusBar.currentHeight ?? 0 : 0,
                elevation: 12,
              }}
            >
              <View className="flex-row items-center">
                <Pressable onPress={handleLeftPress} className="h-10 w-10 items-center justify-center">
                  <MaterialIcons
                    name={isMain ? "menu" : "arrow-back"}
                    size={28}
                    color="#111827"
                  />
                </Pressable>

                <View className="ml-0.5 flex-row items-baseline">
                  <Text className="text-[28px] font-extrabold leading-[28px] text-gray-900">
                    NewLife
                  </Text>
                  <Text className="ml-1 text-sm font-normal leading-[14px] text-gray-900">
                    Danao
                  </Text>
                </View>
              </View>

              <Pressable onPress={handleSettings} className="h-10 w-10 items-center justify-center">
                <MaterialIcons name="settings" size={28} color="#111827" />
              </Pressable>
            </View>
          ) : null}

          <View className="flex-1 bg-gray-100">
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </SafeAreaView>
      </HeaderMenuContext.Provider>
    </GestureHandlerRootView>
  );
}