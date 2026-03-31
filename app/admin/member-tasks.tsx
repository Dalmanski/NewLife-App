// members-task.tsx
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { db } from "../../lib/firebaseConfig";

type ChecklistItem = {
  text: string;
  done: boolean;
};

type Task = {
  id: string;
  memberId: string;
  memberName: string;
  title: string;
  checklist?: ChecklistItem[];
  deadline: string;
};

export default function MemberTasks() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = useCallback(async () => {
    const snap = await getDocs(collection(db, "tasks"));
    const data = snap.docs.map((d) => {
      const raw = d.data() as any;
      const checklist = Array.isArray(raw.checklist)
        ? raw.checklist.map((item: any) =>
            typeof item === "string" ? { text: item, done: false } : { text: item.text ?? "", done: !!item.done }
          )
        : [];

      return {
        id: d.id,
        memberId: String(raw.memberId ?? ""),
        memberName: String(raw.memberName ?? ""),
        title: String(raw.title ?? ""),
        checklist,
        deadline: String(raw.deadline ?? ""),
      } as Task;
    });

    setTasks(data.filter((t) => t.memberId === String(id)));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleChecklist = async (taskId: string, checklistIndex: number) => {
    const nextTasks = tasks.map((task) => {
      if (task.id !== taskId) return task;
      const nextChecklist = (task.checklist ?? []).map((item, index) =>
        index === checklistIndex ? { ...item, done: !item.done } : item
      );
      return { ...task, checklist: nextChecklist };
    });

    setTasks(nextTasks);

    const task = nextTasks.find((t) => t.id === taskId);
    if (!task) return;

    try {
      await updateDoc(doc(db, "tasks", taskId), {
        checklist: task.checklist ?? [],
      });
    } catch {
      await load();
      Alert.alert("Error", "Failed to update checklist");
    }
  };

  const deleteTask = (taskId: string) => {
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "tasks", taskId));
            setTasks((prev) => prev.filter((task) => task.id !== taskId));
          } catch {
            Alert.alert("Error", "Failed to delete task");
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 110 }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>Tasks</Text>
        <Text style={{ fontSize: 16 }}>{String(name ?? "")}</Text>

        {tasks.length === 0 ? (
          <Text>No task yet</Text>
        ) : (
          tasks.map((task) => (
            <View key={task.id} style={{ borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 }}>
              <Text style={{ fontSize: 18, fontWeight: "700" }}>{task.title}</Text>
              <Text>Deadline: {task.deadline}</Text>

              {(task.checklist ?? []).length > 0 && (
                <View style={{ gap: 8 }}>
                  {task.checklist!.map((item, index) => (
                    <Pressable
                      key={index}
                      onPress={() => toggleChecklist(task.id, index)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: item.done ? "#16a34a" : "#6b7280",
                          backgroundColor: item.done ? "#16a34a" : "transparent",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        {item.done ? <Text style={{ color: "white", fontSize: 14, fontWeight: "700" }}>✓</Text> : null}
                      </View>
                      <Text style={{ flex: 1, textDecorationLine: item.done ? "line-through" : "none" }}>
                        {item.text}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={{ alignItems: "flex-end", gap: 10, marginTop: 4 }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "./create-task",
                        params: { id, name, taskId: task.id },
                      })
                    }
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 999,
                      backgroundColor: "#2563eb",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Ionicons name="pencil" size={16} color="white" />
                    <Text style={{ color: "white", fontWeight: "700" }}>Edit</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => deleteTask(task.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 999,
                      backgroundColor: "#dc2626",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Ionicons name="trash" size={16} color="white" />
                    <Text style={{ color: "white", fontWeight: "700" }}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push({ pathname: "./create-task", params: { id, name } })}
        style={{
          position: "absolute",
          right: 20,
          bottom: 20,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: "#111827",
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={30} color="white" />
      </Pressable>
    </View>
  );
}