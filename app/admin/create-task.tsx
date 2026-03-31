// create-task.tsx
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, doc, getDoc, Timestamp, updateDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { db } from "../../lib/firebaseConfig";

type ChecklistItem = {
  text: string;
  done: boolean;
};

type TaskDoc = {
  memberId?: string;
  memberName?: string;
  title?: string;
  checklist?: Array<string | ChecklistItem>;
  deadline?: string;
  deadlineAt?: Timestamp;
};

export default function CreateTask() {
  const router = useRouter();
  const { id, name, taskId } = useLocalSearchParams<{
    id?: string;
    name?: string;
    taskId?: string;
  }>();

  const [title, setTitle] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([{ text: "", done: false }]);
  const [showPicker, setShowPicker] = useState(false);
  const [deadline, setDeadline] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const dateText = useMemo(() => deadline.toISOString().slice(0, 10), [deadline]);

  useEffect(() => {
    const loadTask = async () => {
      if (!taskId) return;

      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "tasks", String(taskId)));
        if (!snap.exists()) {
          Alert.alert("Error", "Task not found");
          router.back();
          return;
        }

        const data = snap.data() as TaskDoc;
        setTitle(data.title ?? "");

        const items = (data.checklist ?? []).map((item) =>
          typeof item === "string" ? { text: item, done: false } : { text: item.text ?? "", done: !!item.done }
        );

        setChecklist(items.length > 0 ? items : [{ text: "", done: false }]);

        if (data.deadlineAt && typeof data.deadlineAt.toDate === "function") {
          setDeadline(data.deadlineAt.toDate());
        } else if (data.deadline) {
          const parsed = new Date(data.deadline);
          if (!Number.isNaN(parsed.getTime())) setDeadline(parsed);
        }
      } catch {
        Alert.alert("Error", "Failed to load task");
      } finally {
        setLoading(false);
      }
    };

    loadTask();
  }, [taskId, router]);

  const updateChecklist = (text: string, index: number) => {
    const next = [...checklist];
    next[index] = { ...next[index], text };
    setChecklist(next);
  };

  const removeChecklistItem = (index: number) => {
    setChecklist((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ text: "", done: false }];
    });
  };

  const save = async () => {
    if (!id || !name || !title.trim()) return Alert.alert("Error", "Fill task title");

    const cleanChecklist = checklist
      .map((item) => ({
        text: item.text.trim(),
        done: !!item.done,
      }))
      .filter((item) => item.text.length > 0);

    try {
      const payload = {
        memberId: String(id),
        memberName: String(name),
        title: title.trim(),
        checklist: cleanChecklist,
        deadline: dateText,
        deadlineAt: Timestamp.fromDate(deadline),
        createdAt: Timestamp.now(),
      };

      if (taskId) {
        await updateDoc(doc(db, "tasks", String(taskId)), payload);
      } else {
        await addDoc(collection(db, "tasks"), payload);
      }

      router.replace({ pathname: "./member-tasks", params: { id, name } });
    } catch {
      Alert.alert("Error", "Failed to save task");
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>{taskId ? "Edit Task" : "Create Task"}</Text>

      <Text style={{ fontSize: 16 }}>{String(name ?? "")}</Text>

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Task title"
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      />

      <Text style={{ fontSize: 16, fontWeight: "600" }}>Checklist</Text>

      {checklist.map((item, index) => (
        <View key={index} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <TextInput
            value={item.text}
            onChangeText={(text) => updateChecklist(text, index)}
            placeholder={`Checklist ${index + 1}`}
            style={{ flex: 1, borderWidth: 1, padding: 12, borderRadius: 10 }}
          />
          <Pressable
            onPress={() => removeChecklistItem(index)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: "#ef4444",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>×</Text>
          </Pressable>
        </View>
      ))}

      <Pressable
        onPress={() => setChecklist((prev) => [...prev, { text: "", done: false }])}
        style={{
          alignSelf: "flex-start",
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: "#111827",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>Add Checklist</Text>
      </Pressable>

      <Pressable
        onPress={() => setShowPicker(true)}
        style={{
          alignSelf: "flex-start",
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: "#2563eb",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>Deadline: {dateText}</Text>
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={deadline}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selected) => {
            setShowPicker(false);
            if (selected) setDeadline(selected);
          }}
        />
      )}

      <Pressable
        onPress={save}
        style={{
          alignSelf: "flex-start",
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: 999,
          backgroundColor: "#16a34a",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>Save Task</Text>
      </Pressable>
    </ScrollView>
  );
}