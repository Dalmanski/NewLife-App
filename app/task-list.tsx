import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
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
      <View className="flex-1 items-center justify-center bg-[#F7F8FA] p-5">
        <Text className="mb-4 text-[#6B7280]">Missing group information.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F7F8FA]">
      <View className="flex-row items-center gap-3 px-[18px] pb-2.5 pt-[18px]">
        <View className="flex-1">
          <Text className="text-2xl font-extrabold text-[#111827]">Task List</Text>
          <Text className="mt-0.5 text-[13px] font-semibold text-[#6B7280]">
            {headerStatus}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-[18px] pb-[110px]"
      >
        {loading ? (
          <View className="py-6">
            <ActivityIndicator />
          </View>
        ) : tasks.length === 0 ? (
          <Text className="pt-6 text-center text-[#6B7280]">No tasks yet</Text>
        ) : (
          tasks.map((task) => (
            <View
              key={task.id}
              className="flex-row items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-3.5"
            >
              <Pressable
                onPress={() => toggleDone(task)}
                className="h-7 w-7 items-center justify-center"
              >
                <Ionicons
                  name={task.isDone ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={task.isDone ? "#16A34A" : "#9CA3AF"}
                />
              </Pressable>

              <View className="flex-1">
                <Text
                  className={`text-base font-extrabold text-[#111827] ${
                    task.isDone ? "text-[#9CA3AF] line-through" : ""
                  }`}
                >
                  {task.title}
                </Text>
                {!!task.notes && (
                  <Text
                    className={`mt-1 text-[13px] leading-[18px] text-[#4B5563] ${
                      task.isDone ? "text-[#9CA3AF] line-through" : ""
                    }`}
                  >
                    {task.notes}
                  </Text>
                )}
              </View>

              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => openEditModal(task)}
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6]"
                >
                  <Ionicons name="create-outline" size={18} color="#111827" />
                </Pressable>

                <Pressable
                  onPress={() => deleteTask(task)}
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6]"
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
        className="absolute bottom-5 right-5 h-[60px] w-[60px] items-center justify-center rounded-full bg-[#111827]"
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>

      <Modal
        visible={showTaskModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTaskModal(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/45"
          onPress={() => setShowTaskModal(false)}
        >
          <Pressable
            onPress={() => {}}
            className="max-h-[90%] rounded-t-[24px] bg-white px-[18px] pb-[18px] pt-2.5"
          >
            <View className="mb-3.5 h-[5px] w-11 self-center rounded-full bg-[#D1D5DB]" />
            <Text className="mb-3.5 text-center text-xl font-extrabold text-[#111827]">
              {editingTask ? "Edit Task" : "New Task"}
            </Text>

            <ScrollView
              className="max-h-full"
              contentContainerClassName="gap-3 pb-2.5"
            >
              <View className="gap-2">
                <Text className="text-[13px] font-extrabold text-[#111827]">
                  Title
                </Text>
                <TextInput
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                  placeholder="Task title"
                  className="rounded-[14px] border border-[#E5E7EB] bg-white px-3.5 py-3 text-[15px] text-[#111827]"
                />
              </View>

              <View className="gap-2">
                <Text className="text-[13px] font-extrabold text-[#111827]">
                  Notes
                </Text>
                <TextInput
                  value={taskNotes}
                  onChangeText={setTaskNotes}
                  placeholder="Optional notes"
                  multiline
                  textAlignVertical="top"
                  className="min-h-[96px] rounded-[14px] border border-[#E5E7EB] bg-white px-3.5 py-3 text-[15px] text-[#111827]"
                />
              </View>

              <View className="flex-row justify-end gap-2.5 pt-1">
                <Pressable
                  onPress={() => setShowTaskModal(false)}
                  className="rounded-[14px] bg-[#E5E7EB] px-4 py-3"
                >
                  <Text className="font-extrabold text-[#111827]">Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={saveTask}
                  disabled={savingTask}
                  className={`rounded-[14px] bg-[#111827] px-4 py-3 ${
                    savingTask ? "opacity-75" : ""
                  }`}
                >
                  <Text className="font-extrabold text-white">
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