import { MaterialIcons } from "@expo/vector-icons";
import * as NavigationBar from "expo-navigation-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { db } from "../lib/firebaseConfig";
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
      { title: "Members", path: "/admin/manage-members", component: ManageMembers },
    ];

    const memberItems: Item[] = [
      { title: "Tasks", path: "/task-board", memberOnly: true, component: Tasks },
      { title: "Calendar", path: "/member/calendar", memberOnly: true, component: MinistryCalendar },
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={() => setSidebarOpen((prev) => !prev)} style={styles.iconBtn}>
          <MaterialIcons name="menu" size={28} color="#111827" />
        </Pressable>

        <Text style={styles.title}>NewLife Danao</Text>

        <Pressable onPress={openSettings} style={styles.iconBtn}>
          <MaterialIcons name="settings" size={28} color="#111827" />
        </Pressable>
      </View>

      <View style={styles.page}>
        {sidebarOpen ? (
          <Pressable style={styles.backdrop} onPress={() => setSidebarOpen(false)} />
        ) : null}

        {sidebarOpen ? (
          <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <MaterialIcons name="person" size={24} color="#6B7280" />
                </View>
                <View style={styles.profileTextWrap}>
                  <Text style={styles.sidebarName}>{memberName}</Text>
                  <Text style={styles.sidebarRole}>{role === "admin" ? "Admin" : "Member"}</Text>
                </View>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sidebarList}>
              {items.map((item) => (
                <Pressable
                  key={item.path}
                  onPress={() => selectItem(item)}
                  style={({ pressed }) => [
                    styles.sidebarItem,
                    activeItem?.path === item.path && styles.sidebarItemActive,
                    pressed && styles.sidebarItemPressed,
                  ]}
                >
                  <Text style={styles.sidebarText}>{item.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.contentWrap}>
          <View style={styles.contentHost}>
            {ActiveComponent ? (
              <ActiveComponent userId={id} userRole={role} memberName={memberName} />
            ) : (
              <View style={styles.emptyFill} />
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
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
    zIndex: 30,
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
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 39, 0.18)",
    zIndex: 10,
  },
  sidebar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: "#FFFFFF",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#E5E7EB",
    zIndex: 20,
    paddingTop: 14,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 0 },
    elevation: 10,
  },
  sidebarHeader: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  profileTextWrap: {
    flex: 1,
  },
  sidebarName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  sidebarRole: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
  },
  sidebarList: {
    paddingBottom: 20,
  },
  sidebarItem: {
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6,
  },
  sidebarItemActive: {
    backgroundColor: "#E8F0FF",
  },
  sidebarItemPressed: {
    opacity: 0.72,
  },
  sidebarText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  contentWrap: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "stretch",
    padding: 0,
  },
  contentHost: {
    flex: 1,
    width: "100%",
  },
  emptyFill: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});