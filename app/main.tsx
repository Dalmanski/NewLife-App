import { MaterialIcons } from "@expo/vector-icons";
import * as NavigationBar from "expo-navigation-bar";
import { useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColorScheme } from "nativewind";
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
import AIAssistance from "./ai-assistance";

const SIDEBAR_WIDTH = 290;

const normalizeRole = (value) => String(value ?? "").trim().toLowerCase();

export default function Main() {
  const { id } = useLocalSearchParams();
  const { setMenuAction } = useContext(HeaderMenuContext);
  const { colorScheme } = useColorScheme();

  const [role, setRole] = useState("");
  const [memberName, setMemberName] = useState("Member");
  const [userEmail, setUserEmail] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMounted, setSidebarMounted] = useState(false);
  const [activePath, setActivePath] = useState("");
  const [displayMemberId, setDisplayMemberId] = useState("");
  const [isLandscape, setIsLandscape] = useState(false);
  const [hoveredPath, setHoveredPath] = useState("");

  const sidebarAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const updateOrientation = () => {
      const { width, height } = Dimensions.get("window");
      setIsLandscape(width > height);
    };

    updateOrientation();
    const subscription = Dimensions.addEventListener("change", updateOrientation);
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const snap = await getDoc(doc(db, "users", String(id)));
      const data = snap.data() || {};
      setRole(normalizeRole(data?.role ?? data?.userRole ?? data?.accountRole ?? ""));
      setMemberName(String(data?.memberName || data?.name || data?.fullName || "Member"));
      setUserEmail(String(data?.email || data?.userEmail || ""));
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
    if (isLandscape) {
      setSidebarOpen(false);
      setSidebarMounted(false);
      sidebarAnim.setValue(0);
      overlayAnim.setValue(0);
      return;
    }

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
  }, [sidebarOpen, sidebarMounted, sidebarAnim, overlayAnim, isLandscape]);

  const items = useMemo(() => {
    const adminItems = [
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
      {
        title: "AI Assistant",
        path: "/ai-assistance",
        component: AIAssistance,
        icon: "smart-toy",
      },
    ];

    const memberItems = [
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
      {
        title: "AI Assistant",
        path: "/ai-assistance",
        component: AIAssistance,
        icon: "smart-toy",
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

  const activeItem = items.find((item) => item.path === activePath) || items[0] || null;
  const ActiveComponent = activeItem?.component || null;

  const selectItem = (item) => {
    setActivePath(item.path);
    if (item.path === "/admin/member") {
      setDisplayMemberId(String(id ?? ""));
    }
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

  const isDark = colorScheme === "dark";

  const renderSidebarContent = () => (
    <>
      <Pressable
        style={[
          styles.profileBlock,
          {
            borderBottomColor: isDark ? "#1F2937" : "#E5E7EB",
          },
        ]}
        onPress={() => {
          const memberItem = items.find((item) => item.path === "/admin/member");
          if (memberItem) {
            selectItem(memberItem);
          }
        }}
      >
        <View style={styles.profileRow}>
          <View
            style={[
              styles.profileIconWrap,
              {
                backgroundColor: isDark ? "#1F2937" : "#F3F4F6",
              },
            ]}
          >
            <MaterialIcons
              name="person"
              size={24}
              color={isDark ? "#9CA3AF" : "#6B7280"}
            />
          </View>

          <View style={styles.profileTextWrap}>
            <Text
              style={[
                styles.profileName,
                {
                  color: isDark ? "#FFFFFF" : "#111827",
                },
              ]}
            >
              {memberName}
            </Text>
            <Text
              style={[
                styles.profileRole,
                {
                  color: isDark ? "#9CA3AF" : "#6B7280",
                },
              ]}
            >
              {role.includes("admin") ? "Admin" : "Member"}
            </Text>
          </View>
        </View>
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.sidebarScrollContent}
      >
        <View style={styles.menuList}>
          {items.map((item) => {
            const isActive = activeItem?.path === item.path;
            const isHovered = hoveredPath === item.path;

            return (
              <Pressable
                key={item.path}
                onPress={() => selectItem(item)}
                onHoverIn={() => setHoveredPath(item.path)}
                onHoverOut={() => setHoveredPath("")}
                style={({ pressed }) => [
                  styles.menuItem,
                  {
                    borderLeftColor: isActive ? "#2563EB" : "transparent",
                    backgroundColor: isActive
                      ? isDark
                        ? "#1F2937"
                        : "#F3F4F6"
                      : pressed || isHovered
                        ? isDark
                          ? "rgba(96, 165, 250, 0.12)"
                          : "rgba(59, 130, 246, 0.10)"
                        : "transparent",
                  },
                ]}
              >
                <MaterialIcons
                  name={item.icon}
                  size={20}
                  color={
                    isActive
                      ? "#2563EB"
                      : isDark
                        ? "#9CA3AF"
                        : "#6B7280"
                  }
                />
                <Text
                  style={[
                    styles.menuText,
                    {
                      color: isActive
                        ? isDark
                          ? "#FFFFFF"
                          : "#111827"
                        : isDark
                          ? "#D1D5DB"
                          : "#4B5563",
                    },
                  ]}
                >
                  {item.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </>
  );

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: isDark ? "#030712" : "#F3F4F6",
        },
      ]}
    >
      <View style={styles.row}>
        {isLandscape ? (
          <View
            style={[
              styles.landscapeSidebar,
              {
                backgroundColor: isDark ? "#111827" : "#FFFFFF",
                borderRightColor: isDark ? "#1F2937" : "#E5E7EB",
              },
            ]}
          >
            {renderSidebarContent()}
          </View>
        ) : null}

        {!isLandscape && sidebarMounted ? (
          <Pressable style={styles.overlayWrap} onPress={() => setSidebarOpen(false)}>
            <Animated.View
              style={[
                styles.overlay,
                {
                  opacity: overlayOpacity,
                  backgroundColor: "rgba(0,0,0,0.35)",
                },
              ]}
            />
          </Pressable>
        ) : null}

        {!isLandscape && sidebarMounted ? (
          <Animated.View
            style={[
              styles.portraitSidebar,
              {
                backgroundColor: isDark ? "#111827" : "#FFFFFF",
                borderRightColor: isDark ? "#1F2937" : "#E5E7EB",
                transform: [{ translateX: sidebarTranslateX }],
              },
            ]}
          >
            {renderSidebarContent()}
          </Animated.View>
        ) : null}

        <View style={styles.contentArea}>
          <View style={styles.contentInner}>
            {ActiveComponent ? (
              <ActiveComponent
                userId={String(id ?? "")}
                userRole={role}
                memberName={memberName}
                userEmail={userEmail}
                memberId={displayMemberId || String(id ?? "")}
                colorScheme={colorScheme}
                isLandscape={isLandscape}
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  backgroundColor: isDark ? "#111827" : "#FFFFFF",
                }}
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  row: {
    flex: 1,
    flexDirection: "row",
  },
  landscapeSidebar: {
    width: 288,
    borderRightWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  portraitSidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    borderRightWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    zIndex: 30,
    elevation: 30,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sidebarScrollContent: {
    paddingBottom: 24,
  },
  profileBlock: {
    marginBottom: 16,
    borderBottomWidth: 1,
    paddingBottom: 16,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileIconWrap: {
    height: 44,
    width: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  profileTextWrap: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "800",
  },
  profileRole: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  menuList: {
    marginBottom: 12,
  },
  menuItem: {
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
  },
  menuText: {
    marginLeft: 12,
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  contentArea: {
    flex: 1,
    alignSelf: "stretch",
    justifyContent: "stretch",
  },
  contentInner: {
    flex: 1,
    width: "100%",
  },
});