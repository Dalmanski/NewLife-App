import { MaterialIcons } from "@expo/vector-icons";
import * as NavigationBar from "expo-navigation-bar";
import { useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "nativewind";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { db } from "../lib/firebaseConfig";
import { HeaderMenuContext } from "./_layout";
import ManageGroup from "./admin/manage-group";
import Group from "./admin/group";
import ManageMembers from "./admin/manage-members";
import Calendar from "./calendar";
import EventScreen from "./event";
import SpecialMeeting from "./member/special-meeting";
import Volunteers from "./member/volunteers";
import Tasks from "./task-board";

const SIDEBAR_WIDTH = 290;

type ScreenComponentProps = {
  userId?: string;
  userRole?: string;
  memberName?: string;
};

type ScreenItem = {
  title: string;
  path: string;
  component: React.ComponentType<ScreenComponentProps>;
  icon: keyof typeof MaterialIcons.glyphMap;
};

const normalizeRole = (value: unknown) => String(value ?? "").trim().toLowerCase();

export default function Main() {
  const { id } = useLocalSearchParams();
  const { setMenuAction } = useContext(HeaderMenuContext);
  const { colorScheme } = useColorScheme();

  const [role, setRole] = useState("");
  const [memberName, setMemberName] = useState("Member");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMounted, setSidebarMounted] = useState(false);
  const [activePath, setActivePath] = useState("");

  const sidebarAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const snap = await getDoc(doc(db, "users", String(id)));
      const data = snap.data() as any;
      setRole(normalizeRole(data?.role ?? data?.userRole ?? data?.accountRole ?? ""));
      setMemberName(
        String(data?.memberName || data?.name || data?.fullName || "Member")
      );
    };
    load();
  }, [id]);

  useEffect(() => {
    const showNav = async () => {
      if (Platform.OS === "android") {
        await NavigationBar.setVisibilityAsync("visible");
      }
    };
    showNav();
  }, []);

  useEffect(() => {
    setMenuAction(() => () => {
      setSidebarMounted(true);
      setSidebarOpen((prev) => !prev);
    });

    return () => {
      setMenuAction(null);
    };
  }, [setMenuAction]);

  useEffect(() => {
    if (sidebarOpen) {
      setSidebarMounted(true);
      Animated.parallel([
        Animated.timing(sidebarAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (sidebarMounted) {
      Animated.parallel([
        Animated.timing(sidebarAnim, {
          toValue: 0,
          duration: 210,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 210,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setSidebarMounted(false);
      });
    }
  }, [sidebarOpen, sidebarMounted, sidebarAnim, overlayAnim]);

  const items = useMemo<ScreenItem[]>(() => {
    const adminItems: ScreenItem[] = [
      { title: "Group", path: "/admin/group", component: Group, icon: "groups" },
      {
        title: "Manage Group",
        path: "/admin/manage-group",
        component: ManageGroup,
        icon: "groups",
      },
      {
        title: "Calendar",
        path: "/calendar",
        component: Calendar,
        icon: "calendar-month",
      },
      { title: "Event", path: "/event", component: EventScreen, icon: "event" },
      {
        title: "Members",
        path: "/admin/manage-members",
        component: ManageMembers,
        icon: "person",
      },
    ];

    const memberItems: ScreenItem[] = [
      { title: "Tasks", path: "/task-board", component: Tasks, icon: "task-alt" },
      {
        title: "Calendar",
        path: "/calendar",
        component: Calendar,
        icon: "calendar-month",
      },
      { title: "Event", path: "/event", component: EventScreen, icon: "event" },
      {
        title: "Volunteer",
        path: "/member/volunteers",
        component: Volunteers,
        icon: "volunteer-activism",
      },
      {
        title: "Special Meeting",
        path: "/member/special-meeting",
        component: SpecialMeeting,
        icon: "groups-2",
      },
    ];

    return role.includes("admin") ? adminItems : memberItems;
  }, [role]);

  useEffect(() => {
    if (!items.length) return;
    const stillValid = items.some((item) => item.path === activePath);
    if (!activePath || !stillValid) {
      setActivePath(items[0].path);
    }
  }, [items, activePath]);

  const activeItem =
    items.find((item) => item.path === activePath) || items[0] || null;
  const ActiveComponent = activeItem?.component || null;

  const selectItem = (item: ScreenItem) => {
    setActivePath(item.path);
    setSidebarOpen(false);
  };

  const sidebarTranslateX = sidebarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SIDEBAR_WIDTH, 0],
  });

  const overlayOpacity = overlayAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View className="flex-1 bg-gray-100 dark:bg-gray-950">
      <View className="flex-1">
        {sidebarMounted ? (
          <Pressable
            className="absolute inset-0 z-10"
            onPress={() => setSidebarOpen(false)}
          >
            <Animated.View
              style={{ opacity: overlayOpacity }}
              className="flex-1 bg-black/30 dark:bg-black/50"
            />
          </Pressable>
        ) : null}

        {sidebarMounted ? (
          <Animated.View
            style={{
              width: SIDEBAR_WIDTH,
              transform: [{ translateX: sidebarTranslateX }],
            }}
            className="absolute bottom-0 left-0 top-0 z-20 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 pt-5 shadow-2xl"
          >
            <View className="mb-4 border-b border-gray-200 dark:border-gray-800 pb-4">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                  <MaterialIcons name="person" size={24} color={colorScheme === "dark" ? "#9CA3AF" : "#6B7280"} />
                </View>
                <View className="flex-1">
                  <Text className="text-[18px] font-extrabold text-gray-900 dark:text-white">
                    {memberName}
                  </Text>
                  <Text className="mt-1 text-[12px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {role.includes("admin") ? "Admin" : "Member"}
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerClassName="pb-6"
            >
              <View className="mb-3">
                {items.map((item) => {
                  const isActive = activeItem?.path === item.path;

                  return (
                    <Pressable
                      key={item.path}
                      onPress={() => selectItem(item)}
                      className={`mb-1 flex-row items-center border-l-4 px-3 py-3 ${
                        isActive
                          ? "border-blue-600 bg-gray-100 dark:bg-gray-800"
                          : "border-transparent bg-transparent"
                      }`}
                    >
                      <MaterialIcons
                        name={item.icon}
                        size={20}
                        color={isActive ? "#2563EB" : colorScheme === "dark" ? "#9CA3AF" : "#6B7280"}
                      />

                      <Text
                        className={`ml-3 flex-1 text-[15px] font-semibold ${
                          isActive ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {item.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </Animated.View>
        ) : null}

        <View className="flex-1 items-stretch justify-stretch">
          <View className="w-full flex-1">
            {ActiveComponent ? (
              <ActiveComponent
                userId={String(id ?? "")}
                userRole={role}
                memberName={memberName}
              />
            ) : (
              <View className="flex-1 bg-white" />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}