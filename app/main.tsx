import { MaterialIcons } from "@expo/vector-icons";
import * as NavigationBar from "expo-navigation-bar";
import { useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useContext, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { db } from "../lib/firebaseConfig";
import { HeaderMenuContext } from "./_layout";
import ManageGroup from "./admin/manage-group";
import ManageMembers from "./admin/manage-members";
import Calendar from "./calendar";
import EventScreen from "./event";
import SpecialMeeting from "./member/special-meeting";
import Volunteers from "./member/volunteers";
import Tasks from "./task-board";

export default function Main() {
  const { id } = useLocalSearchParams();
  const { setMenuAction } = useContext(HeaderMenuContext);

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
        await NavigationBar.setBackgroundColorAsync("#ffffff");
      }
    };
    showNav();
  }, []);

  useEffect(() => {
    setMenuAction(() => () => {
      setSidebarOpen((prev) => !prev);
    });

    return () => {
      setMenuAction(null);
    };
  }, [setMenuAction]);

  const items = useMemo(() => {
    const adminItems = [
      {
        title: "Manage Group",
        path: "/admin/manage-group",
        component: ManageGroup,
      },
      { title: "Calendar", path: "/calendar", component: Calendar },
      { title: "Event", path: "/event", component: EventScreen },
      {
        title: "Members",
        path: "/admin/manage-members",
        component: ManageMembers,
      },
    ];

    const memberItems = [
      { title: "Tasks", path: "/task-board", component: Tasks },
      { title: "Calendar", path: "/calendar", component: Calendar },
      { title: "Event", path: "/event", component: EventScreen },
      {
        title: "Volunteer",
        path: "/member/volunteers",
        component: Volunteers,
      },
      {
        title: "Special Meeting",
        path: "/member/special-meeting",
        component: SpecialMeeting,
      },
    ];

    return role === "admin" ? adminItems : memberItems;
  }, [role]);

  useEffect(() => {
    if (!activePath && items.length > 0) {
      setActivePath(items[0].path);
    }
  }, [items, activePath]);

  const activeItem =
    items.find((item) => item.path === activePath) || items[0] || null;
  const ActiveComponent = activeItem?.component || null;

  const selectItem = (item) => {
    setActivePath(item.path);
    setSidebarOpen(false);
  };

  return (
    <View className="flex-1 bg-gray-100">
      <View className="flex-1">
        {sidebarOpen ? (
          <Pressable
            className="absolute inset-0 z-10 bg-gray-900/20"
            onPress={() => setSidebarOpen(false)}
          />
        ) : null}

        {sidebarOpen ? (
          <View className="absolute bottom-0 left-0 top-0 z-20 w-[280px] border-r border-gray-200 bg-white px-3 pt-4 shadow-2xl">
            <View className="mb-4 border-b border-gray-200 pb-3">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-gray-100">
                  <MaterialIcons name="person" size={24} color="#6B7280" />
                </View>
                <View className="flex-1">
                  <Text className="text-[18px] font-extrabold text-gray-900">
                    {memberName}
                  </Text>
                  <Text className="mt-1 text-[13px] font-semibold text-gray-500">
                    {role === "admin" ? "Admin" : "Member"}
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerClassName="pb-5"
            >
              {items.map((item) => {
                const isActive = activeItem?.path === item.path;
                return (
                  <Pressable
                    key={item.path}
                    onPress={() => selectItem(item)}
                    className={`mb-1 rounded-xl px-3 py-3 ${
                      isActive ? "bg-blue-100" : ""
                    }`}
                  >
                    <Text className="text-[15px] font-bold text-gray-900">
                      {item.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View className="flex-1 items-stretch justify-stretch">
          <View className="w-full flex-1">
            {ActiveComponent ? (
              <ActiveComponent
                userId={id}
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