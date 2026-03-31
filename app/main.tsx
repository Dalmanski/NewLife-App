import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { db } from "../lib/firebaseConfig";

type Item = { title: string; path: string; memberOnly?: boolean };

export default function Main() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [role, setRole] = useState("");
  const [memberName, setMemberName] = useState("");

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

  const items = useMemo<Item[]>(() => {
    const adminItems: Item[] = [
      { title: "Manage Members", path: "admin/manage-members" },
      { title: "Plot Calendar", path: "admin/plot-calendar" },
      { title: "Manage Ministry", path: "admin/manage-ministry" },
      { title: "Manage Core Group", path: "admin/manage-core-group" }
    ];

    const memberItems: Item[] = [
      { title: "Ministry Calendar", path: "member/calendar", memberOnly: true },
      { title: "Tasks", path: "member/tasks", memberOnly: true },
      { title: "Volunteer", path: "member/volunteers", memberOnly: true },
      { title: "Special Meeting", path: "member/special-meeting", memberOnly: true },
    ];

    return role === "admin" ? adminItems : memberItems;
  }, [role]);

  const goTo = (item: Item) => {
    if (item.memberOnly) {
      router.push({
        pathname: item.path as never,
        params: {
          memberId: String(id || ""),
          memberName: memberName,
        },
      });
      return;
    }

    router.push(item.path as never);
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 14 }}>
      <Pressable onPress={() => router.push("/settings")} style={{ position: "absolute", top: 50, right: 20, padding: 10 }}>
        <MaterialIcons name="settings" size={28} />
      </Pressable>

      <Text style={{ fontSize: 28, fontWeight: "700", textAlign: "center" }}>NewLife Danao</Text>

      <Text style={{ textAlign: "center", fontSize: 18, fontWeight: "600" }}>
        {memberName || "User"}
      </Text>

      <Text style={{ textAlign: "center" }}>
        {role === "admin" ? "Admin" : "Member"}
      </Text>

      {items.map((item) => (
        <Pressable key={item.path} onPress={() => goTo(item)} style={{ borderWidth: 1, padding: 14, borderRadius: 12 }}>
          <Text style={{ textAlign: "center", fontSize: 16 }}>{item.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}