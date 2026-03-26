import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { db } from "../lib/firebaseConfig";

export default function Main() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [role, setRole] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const snap = await getDoc(doc(db, "users", String(id)));
      setRole(String(snap.data()?.role || ""));
    };
    load();
  }, [id]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <TouchableOpacity onPress={() => router.push("/settings")} style={{ position: "absolute", top: 50, right: 20, padding: 10 }}>
        <MaterialIcons name="settings" size={28} />
      </TouchableOpacity>

      {role === "admin" && (
        <TouchableOpacity onPress={() => router.push("/manage-members")} style={{ position: "absolute", top: 50, right: 70, borderWidth: 1, padding: 10 }}>
          <Text>Manage Members</Text>
        </TouchableOpacity>
      )}

      <Text>Hello World</Text>
    </View>
  );
}