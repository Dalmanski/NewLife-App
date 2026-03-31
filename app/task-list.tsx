import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    Timestamp,
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    updateDoc,
    where,
} from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { db } from "../lib/firebaseConfig";

type TaskItem = {
  id: string;
  title: string;
  notes?: string;
  isDone: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  groupId: string;
  groupName?: string;
  groupKind?: string;
};

export default function TaskList() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    groupId?: string;
    groupName?: string;
    groupKind?: string;
    id?: string;
  }>();

  const groupId = String(params.groupId ?? "");
  const groupName = String(params.groupName ?? "Task List");
  const groupKind = String(params.groupKind ?? "");

  const [loading, setLoading] = useState(true);
  const [savingTask, setSavingTask] = useState(false);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  const canLoad = useMemo(() => !!groupId, [groupId]);

  const loadTasks = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "tasks"), where("groupId", "==", groupId))
      );

      const data: TaskItem[] = snap.docs
        .map((d) => {
          const raw = d.data() as any;
          return {
            id: d.id,
            title: String(raw?.title ?? "").trim(),
            notes: String(raw?.notes ?? "").trim(),
            isDone: Boolean(raw?.isDone ?? false),
            createdAt: raw?.createdAt,
            updatedAt: raw?.updatedAt,
            groupId: String(raw?.groupId ?? groupId),
            groupName: String(raw?.groupName ?? groupName),
            groupKind: String(raw?.groupKind ?? groupKind),
          };
        })
        .filter((x) => x.title)
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });

      setTasks(data);
    } catch {
      Alert.alert("Error", "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [groupId, groupName, groupKind]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  const openCreateModal = () => {
    setEditingTask(null);
    setTaskTitle("");
    setTaskNotes("");
    setShowTaskModal(true);
  };

  const openEditModal = (task: TaskItem) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskNotes(task.notes ?? "");
    setShowTaskModal(true);
  };

  const saveTask = async () => {
    const title = taskTitle.trim();
    const notes = taskNotes.trim();

    if (!groupId) {
      return Alert.alert("Error", "Missing group id");
    }

    if (!title) {
      return Alert.alert("Error", "Please enter task title");
    }

    setSavingTask(true);
    try {
      const payload = {
        title,
        notes,
        isDone: editingTask?.isDone ?? false,
        groupId,
        groupName,
        groupKind,
        createdAt: editingTask?.createdAt ?? Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      if (editingTask) {
        await updateDoc(doc(db, "tasks", editingTask.id), payload);
      } else {
        await addDoc(collection(db, "tasks"), payload);
      }

      setTaskTitle("");
      setTaskNotes("");
      setEditingTask(null);
      setShowTaskModal(false);
      await loadTasks();
    } catch {
      Alert.alert("Error", "Failed to save task");
    } finally {
      setSavingTask(false);
    }
  };

  const toggleDone = async (task: TaskItem) => {
    try {
      await updateDoc(doc(db, "tasks", task.id), {
        isDone: !task.isDone,
        updatedAt: Timestamp.now(),
      });
      await loadTasks();
    } catch {
      Alert.alert("Error", "Failed to update task");
    }
  };

  const deleteTask = (task: TaskItem) => {
    Alert.alert("Delete Task", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "tasks", task.id));
            await loadTasks();
          } catch {
            Alert.alert("Error", "Failed to delete task");
          }
        },
      },
    ]);
  };

  const headerStatus = useMemo(() => {
    return `${groupKind === "ministry" ? "Ministry" : "Core Group"} • ${groupName}`;
  }, [groupKind, groupName]);

  if (!canLoad) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.errorText}>Missing group information.</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Task List</Text>
          <Text style={styles.subtitle}>{headerStatus}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {loading ? (
          <View style={{ paddingVertical: 24 }}>
            <ActivityIndicator />
          </View>
        ) : tasks.length === 0 ? (
          <Text style={styles.emptyText}>No tasks yet</Text>
        ) : (
          tasks.map((task) => (
            <View key={task.id} style={styles.card}>
              <Pressable
                onPress={() => toggleDone(task)}
                style={({ pressed }) => [
                  styles.checkButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={task.isDone ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={task.isDone ? "#16A34A" : "#9CA3AF"}
                />
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, task.isDone && styles.doneText]}>
                  {task.title}
                </Text>
                {!!task.notes && (
                  <Text style={[styles.cardNotes, task.isDone && styles.doneText]}>
                    {task.notes}
                  </Text>
                )}
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => openEditModal(task)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="create-outline" size={18} color="#111827" />
                </Pressable>

                <Pressable
                  onPress={() => deleteTask(task)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Pressable
        onPress={openCreateModal}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>

      <Modal
        visible={showTaskModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTaskModal(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowTaskModal(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {editingTask ? "Edit Task" : "New Task"}
            </Text>

            <ScrollView contentContainerStyle={styles.sheetContent}>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Title</Text>
                <TextInput
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                  placeholder="Task title"
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                  value={taskNotes}
                  onChangeText={setTaskNotes}
                  placeholder="Optional notes"
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, styles.textArea]}
                />
              </View>

              <View style={styles.actions}>
                <Pressable
                  onPress={() => setShowTaskModal(false)}
                  style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={saveTask}
                  disabled={savingTask}
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.pressed,
                    savingTask && { opacity: 0.75 },
                  ]}
                >
                  <Text style={styles.saveText}>
                    {savingTask ? "Saving..." : editingTask ? "Update" : "Create"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  header: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    marginTop: 2,
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },
  container: {
    padding: 18,
    paddingBottom: 110,
    gap: 12,
  },
  emptyText: {
    color: "#6B7280",
    textAlign: "center",
    paddingTop: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkButton: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  cardNotes: {
    marginTop: 4,
    color: "#4B5563",
    fontSize: 13,
    lineHeight: 18,
  },
  doneText: {
    textDecorationLine: "line-through",
    color: "#9CA3AF",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    maxHeight: "90%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 99,
    backgroundColor: "#D1D5DB",
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 14,
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 10,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#fff",
  },
  textArea: {
    minHeight: 96,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    paddingTop: 4,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
  },
  cancelText: {
    fontWeight: "800",
    color: "#111827",
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#111827",
  },
  saveText: {
    fontWeight: "800",
    color: "#fff",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  errorText: {
    color: "#6B7280",
    marginBottom: 14,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#111827",
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
});