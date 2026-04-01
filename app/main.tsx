import { MaterialIcons } from "@expo/vector-icons";
import * as NavigationBar from "expo-navigation-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Platform, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { db } from "../lib/firebaseConfig";
import EventScreen from "./event";
import ManageGroup from "./admin/manage-group";
import ManageMembers from "./admin/manage-members";
import PlotCalendar from "./admin/plot-calendar";
import MinistryCalendar from "./member/calendar";
import SpecialMeeting from "./member/special-meeting";
import Volunteers from "./member/volunteers";
import Tasks from "./task-board";

type Item = {
  title: string;
  path: string;
  memberOnly?: boolean;
  component: ComponentType<any>;
};

export default function Main() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [role, setRole] = useState("");
  const [memberName, setMemberName] = useState("Member");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePath, setActivePath] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const snap = await getDoc(doc(db, "users", String(id)));
      const data = snap.data();
      setRole(String(data?.role || ""));
      setMemberName(String(data?.memberName || data?.name || data?.fullName || "Member"));
    };
    load();
  }, [id]);

  useEffect(() => {
    const hideNav = async () => {
      if (Platform.OS === "android") {
        await NavigationBar.setVisibilityAsync("hidden");
      }
    };
    hideNav();
  }, []);

  const items = useMemo<Item[]>(() => {
    const adminItems: Item[] = [
      { title: "Manage Group", path: "/admin/manage-group", component: ManageGroup },
      { title: "Calendar", path: "/admin/plot-calendar", component: PlotCalendar },
      { title: "Event", path: "/event", component: EventScreen },
      { title: "Members", path: "/admin/manage-members", component: ManageMembers },
    ];

    const memberItems: Item[] = [
      { title: "Tasks", path: "/task-board", memberOnly: true, component: Tasks },
      { title: "Calendar", path: "/member/calendar", memberOnly: true, component: MinistryCalendar },
      { title: "Event", path: "/event", memberOnly: true, component: EventScreen },
      { title: "Volunteer", path: "/member/volunteers", memberOnly: true, component: Volunteers },
      { title: "Special Meeting", path: "/member/special-meeting", memberOnly: true, component: SpecialMeeting },
    ];

    return role === "admin" ? adminItems : memberItems;
  }, [role]);

  useEffect(() => {
    if (!activePath && items.length > 0) {
      setActivePath(items[0].path);
    }
  }, [items, activePath]);

  const activeItem = items.find((item) => item.path === activePath) || items[0] || null;
  const ActiveComponent = activeItem?.component || null;

  const openSettings = () => {
    router.push("/settings" as never);
  };

  const selectItem = (item: Item) => {
    setActivePath(item.path);
    setSidebarOpen(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <View className="h-[60px] flex-row items-center justify-between border-b border-gray-200 bg-white px-4 z-30">
        <Pressable onPress={() => setSidebarOpen((prev) => !prev)} className="h-10 w-10 items-center justify-center">
          <MaterialIcons name="menu" size={28} color="#111827" />
        </Pressable>

        <Text className="text-[18px] font-extrabold text-gray-900">NewLife Danao</Text>

        <Pressable onPress={openSettings} className="h-10 w-10 items-center justify-center">
          <MaterialIcons name="settings" size={28} color="#111827" />
        </Pressable>
      </View>

      <View className="flex-1">
        {sidebarOpen ? (
          <Pressable className="absolute inset-0 bg-gray-900/20 z-10" onPress={() => setSidebarOpen(false)} />
        ) : null}

        {sidebarOpen ? (
          <View className="absolute left-0 top-0 bottom-0 z-20 w-[280px] border-r border-gray-200 bg-white px-3 pt-4 shadow-2xl">
            <View className="mb-4 border-b border-gray-200 pb-3">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-gray-100">
                  <MaterialIcons name="person" size={24} color="#6B7280" />
                </View>
                <View className="flex-1">
                  <Text className="text-[18px] font-extrabold text-gray-900">{memberName}</Text>
                  <Text className="mt-1 text-[13px] font-semibold text-gray-500">
                    {role === "admin" ? "Admin" : "Member"}
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-5">
              {items.map((item) => {
                const isActive = activeItem?.path === item.path;
                return (
                  <Pressable
                    key={item.path}
                    onPress={() => selectItem(item)}
                    className={`mb-1 rounded-xl px-3 py-3 ${isActive ? "bg-blue-100" : ""}`}
                  >
                    <Text className="text-[15px] font-bold text-gray-900">{item.title}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View className="flex-1 items-stretch justify-stretch">
          <View className="flex-1 w-full">
            {ActiveComponent ? (
              <ActiveComponent userId={id} userRole={role} memberName={memberName} />
            ) : (
              <View className="flex-1 bg-white" />
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}