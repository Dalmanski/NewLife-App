import { useLocalSearchParams } from "expo-router";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
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
  deadline: string;
  checklist?: Array<string | ChecklistItem>;
};

export default function Tasks() {
  const params = useLocalSearchParams<{ memberId?: string | string[]; memberName?: string | string[] }>();

  const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId ?? "";
  const memberName = Array.isArray(params.memberName) ? params.memberName[0] : params.memberName ?? "Member";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(collection(db, "tasks"));
      setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, "id">) })));
    };
    load();
  }, []);

  const memberTasks = useMemo(() => {
    if (!memberId) return [];
    return tasks.filter((task) => task.memberId === memberId);
  }, [tasks, memberId]);

  const normalizeChecklist = (checklist?: Array<string | ChecklistItem>): ChecklistItem[] => {
    if (!checklist || checklist.length === 0) return [];
    return checklist.map((item) =>
      typeof item === "string"
        ? { text: item, done: false }
        : { text: String(item.text ?? ""), done: !!item.done }
    );
  };

  const toggleChecklistItem = async (taskId: string, checklistIndex: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentChecklist = normalizeChecklist(task.checklist);
    const nextChecklist = currentChecklist.map((item, index) =>
      index === checklistIndex ? { ...item, done: !item.done } : item
    );

    setSavingId(taskId);

    const previousTasks = tasks;

    try {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                checklist: nextChecklist,
              }
            : t
        )
      );

      await updateDoc(doc(db, "tasks", taskId), {
        checklist: nextChecklist,
      });
    } catch {
      setTasks(previousTasks);
      Alert.alert("Error", "Failed to update checklist");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>{memberName}'s Tasks</Text>

      {memberTasks.length > 0 ? (
        memberTasks.map((task) => {
          const checklist = normalizeChecklist(task.checklist);

          return (
            <View key={task.id} style={{ borderWidth: 1, padding: 12, borderRadius: 12, gap: 10 }}>
              <View style={{ gap: 4 }}>
                <Text style={{ fontWeight: "700", fontSize: 16 }}>{task.title}</Text>
                <Text>{task.deadline}</Text>
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ fontWeight: "700" }}>Checklist</Text>

                {checklist.length > 0 ? (
                  checklist.map((item, index) => (
                    <Pressable
                      key={`${task.id}-${index}`}
                      onPress={() => toggleChecklistItem(task.id, index)}
                      disabled={savingId === task.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderWidth: 1,
                          borderRadius: 6,
                          justifyContent: "center",
                          alignItems: "center",
                          backgroundColor: item.done ? "#16a34a" : "#fff",
                          borderColor: item.done ? "#16a34a" : "#999",
                        }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                          {item.done ? "✓" : ""}
                        </Text>
                      </View>

                      <Text
                        style={{
                          flex: 1,
                          textDecorationLine: item.done ? "line-through" : "none",
                          opacity: item.done ? 0.6 : 1,
                        }}
                      >
                        {item.text}
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <Text>No checklist items.</Text>
                )}
              </View>
            </View>
          );
        })
      ) : (
        <Text>No tasks for this member.</Text>
      )}
    </ScrollView>
  );
}