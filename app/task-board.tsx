import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { db } from "../lib/firebaseConfig";

type TaskStatus = "todo" | "doing" | "done";

type ChecklistItem = {
  text: string;
  done: boolean;
};

type TaskDoc = {
  groupId?: string;
  groupName?: string;
  groupKind?: string;
  title?: string;
  description?: string;
  checklist?: Array<string | ChecklistItem>;
  status?: TaskStatus;
  order?: number;
  deadline?: string;
  deadlineAt?: Timestamp;
  assignedMemberIds?: string[];
  assignedMemberNames?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type TaskItem = {
  id: string;
  groupId: string;
  groupName: string;
  groupKind: string;
  title: string;
  description: string;
  checklist: ChecklistItem[];
  status: TaskStatus;
  order: number;
  deadline: string;
  deadlineAt?: Timestamp;
  assignedMemberIds: string[];
  assignedMemberNames: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type UserOption = {
  id: string;
  name: string;
  role: string;
  ministry: string[];
  coreGroup: string[];
};

type DragState = {
  task: TaskItem;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ColumnRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type GroupInfo = {
  name: string;
  description: string;
};

type TaskBoardProps = {
  userId?: string;
  userRole?: string;
  memberName?: string;
  targetMemberId?: string;
  targetMemberName?: string;
};

const statusList: Array<{
  key: TaskStatus;
  label: string;
}> = [
  { key: "todo", label: "To Do" },
  { key: "doing", label: "Doing" },
  { key: "done", label: "Done" },
];

const normalizeChecklist = (value: TaskDoc["checklist"] = []) => {
  return value.map((item) =>
    typeof item === "string"
      ? { text: item, done: false }
      : { text: String(item?.text ?? ""), done: !!item?.done }
  );
};

const normalizeGroupArray = (value: unknown) => {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
};

const isAdminRole = (role: string) => role.toLowerCase().includes("admin");

const formatDateDisplay = (date: Date) => {
  const day = date.getDate();
  const year = date.getFullYear();
  const month = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][date.getMonth()];
  return `${month} ${day}, ${year}`;
};

const formatDeadlineText = (deadline?: string, deadlineAt?: Timestamp) => {
  if (deadlineAt && typeof deadlineAt.toDate === "function") {
    return formatDateDisplay(deadlineAt.toDate());
  }

  if (!deadline) return "";

  const parsed = new Date(deadline);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateDisplay(parsed);
  }

  return deadline;
};

type TaskCardProps = {
  task: TaskItem;
  onOpen: (task: TaskItem) => void;
  onDelete?: (taskId: string) => void;
  onToggleChecklist: (taskId: string, checklistIndex: number, nextDone: boolean) => void;
  onStartDrag: (task: TaskItem, x: number, y: number, width: number, height: number) => void;
  canManageTask: boolean;
  showGroupMeta: boolean;
};

function TaskCard({
  task,
  onOpen,
  onDelete,
  onToggleChecklist,
  onStartDrag,
  canManageTask,
  showGroupMeta,
}: TaskCardProps) {
  const [layout, setLayout] = useState({ width: 300, height: 120 });
  const [showChecklist, setShowChecklist] = useState(false);
  const suppressOpen = useRef(false);

  const blockOpenBriefly = () => {
    suppressOpen.current = true;
    setTimeout(() => {
      suppressOpen.current = false;
    }, 150);
  };

  const checklistDone = task.checklist.filter((x) => x.done).length;
  const checklistTotal = task.checklist.length;
  const descriptionText =
    task.description && task.description.trim()
      ? task.description
      : "No description provided";
  const formattedDeadline = formatDeadlineText(task.deadline, task.deadlineAt);

  return (
    <Pressable
      onLayout={(e) =>
        setLayout({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        })
      }
      onPress={() => {
        if (!suppressOpen.current && canManageTask) onOpen(task);
      }}
      onLongPress={(evt) => {
        blockOpenBriefly();
        onStartDrag(
          task,
          evt.nativeEvent.pageX,
          evt.nativeEvent.pageY,
          layout.width || 300,
          layout.height || 120
        );
      }}
      delayLongPress={500}
      className={`rounded-[22px] border border-slate-200 bg-white p-4 ${
        false ? "opacity-25" : ""
      }`}
      style={{
        gap: 12,
        shadowColor: "#0f172a",
        shadowOpacity: 0.06,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 2,
      }}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1" style={{ gap: 6 }}>
          <Text className="text-[16px] font-extrabold leading-5 text-slate-900">
            {task.title}
          </Text>

          {showGroupMeta ? (
            <View className="self-start rounded-full bg-slate-100 px-2.5 py-1">
              <Text className="text-[11px] font-bold text-slate-500">
                {task.groupName || "Group"}
              </Text>
            </View>
          ) : null}
        </View>

        {canManageTask && onDelete ? (
          <Pressable
            onPressIn={blockOpenBriefly}
            onPress={() => onDelete(task.id)}
            className="h-8 w-8 items-center justify-center rounded-full bg-red-50"
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={18} color="#b91c1c" />
          </Pressable>
        ) : null}
      </View>

      <Text className="text-[13px] leading-[19px] text-slate-600">{descriptionText}</Text>

      <View style={{ gap: 10 }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <View className="rounded-full bg-slate-100 px-2.5 py-1">
              <Text className="text-[11px] font-bold text-slate-600">
                Checklist {checklistDone}/{checklistTotal}
              </Text>
            </View>

            {checklistTotal > 0 ? (
              <Pressable
                onPressIn={blockOpenBriefly}
                onPress={() => setShowChecklist((prev) => !prev)}
                className="h-8 w-8 items-center justify-center rounded-full bg-slate-100"
                hitSlop={8}
              >
                <Ionicons
                  name={showChecklist ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#0f172a"
                />
              </Pressable>
            ) : null}
          </View>

          <View className="flex-row items-center" style={{ gap: 8 }}>
            {formattedDeadline ? (
              <View className="rounded-full bg-amber-50 px-2.5 py-1">
                <Text className="text-[11px] font-bold text-amber-700">
                  Due {formattedDeadline}
                </Text>
              </View>
            ) : (
              <View className="rounded-full bg-slate-100 px-2.5 py-1">
                <Text className="text-[11px] font-bold text-slate-500">No deadline</Text>
              </View>
            )}
          </View>
        </View>

        {showChecklist && task.checklist.length > 0 ? (
          <View style={{ gap: 8 }}>
            {task.checklist.map((item, index) => (
              <Pressable
                key={`${task.id}-check-${index}`}
                onPressIn={blockOpenBriefly}
                onPress={() => onToggleChecklist(task.id, index, !item.done)}
                className="flex-row items-center rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                style={({ pressed }) => [
                  pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                ]}
              >
                <View
                  className={`mr-3 h-6 w-6 items-center justify-center rounded-full border-2 ${
                    item.done
                      ? "border-slate-900 bg-slate-900"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {item.done ? (
                    <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                  ) : null}
                </View>

                <Text
                  className={`flex-1 text-[13px] leading-[18px] ${
                    item.done ? "text-slate-400 line-through" : "text-slate-900"
                  }`}
                >
                  {item.text}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {task.assignedMemberNames.length > 0 ? (
        <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
          {task.assignedMemberNames.slice(0, 3).map((name, index) => (
            <View
              key={`${name}-${index}`}
              className="flex-row items-center rounded-full bg-slate-100 px-3 py-1.5"
              style={{ gap: 6 }}
            >
              <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-white">
                <Ionicons name="person" size={12} color="#64748b" />
              </View>
              <Text className="text-xs font-bold text-slate-800">{name}</Text>
            </View>
          ))}
          {task.assignedMemberNames.length > 3 ? (
            <Text className="text-xs font-bold text-slate-500">
              +{task.assignedMemberNames.length - 3}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export default function TaskBoard({
  userId,
  userRole,
  memberName,
  targetMemberId,
  targetMemberName,
}: TaskBoardProps) {
  const params = useLocalSearchParams<{
    groupId?: string;
    groupName?: string;
    groupKind?: string;
    id?: string;
    name?: string;
    memberId?: string;
    memberName?: string;
    userRole?: string;
  }>();

  const currentGroupId = String(params.groupId ?? "");
  const currentGroupName = String(params.groupName ?? "");
  const currentGroupKind = String(params.groupKind ?? "");
  const groupCollectionName = currentGroupKind === "coreGroup" ? "coreGroups" : "ministries";

  const currentUserId = String(userId ?? params.id ?? "");
  const currentMemberId = String(targetMemberId ?? params.memberId ?? params.id ?? "");
  const currentMemberName = String(
    targetMemberName ?? params.memberName ?? params.name ?? memberName ?? "Member"
  );
  const initialRole = String(userRole ?? params.userRole ?? "");

  const hasGroupContext = !!currentGroupId && !!currentGroupName;
  const hasMemberContext = !hasGroupContext && !!currentMemberId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupInfo>({
    name: currentGroupName,
    description: "",
  });
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskChecklist, setTaskChecklist] = useState<ChecklistItem[]>([
    { text: "", done: false },
  ]);
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>("todo");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [deadline, setDeadline] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [columnRects, setColumnRects] = useState<Record<TaskStatus, ColumnRect | null>>({
    todo: null,
    doing: null,
    done: null,
  });
  const [role, setRole] = useState(initialRole);

  const dragStateRef = useRef<DragState | null>(null);
  const columnRectsRef = useRef<Record<TaskStatus, ColumnRect | null>>({
    todo: null,
    doing: null,
    done: null,
  });

  const todoColRef = useRef<View | null>(null);
  const doingColRef = useRef<View | null>(null);
  const doneColRef = useRef<View | null>(null);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    columnRectsRef.current = columnRects;
  }, [columnRects]);

  useEffect(() => {
    const loadRole = async () => {
      if (role || !currentUserId) return;
      try {
        const snap = await getDoc(doc(db, "users", currentUserId));
        const data = snap.data();
        setRole(String(data?.role ?? ""));
      } catch {
        setRole("");
      }
    };
    loadRole();
  }, [currentUserId, role]);

  const canManageTasks = isAdminRole(role);

  const measureColumns = useCallback(() => {
    const refs: Array<[TaskStatus, React.RefObject<View>]> = [
      ["todo", todoColRef],
      ["doing", doingColRef],
      ["done", doneColRef],
    ];

    refs.forEach(([status, ref]) => {
      ref.current?.measureInWindow((x, y, width, height) => {
        setColumnRects((prev) => ({
          ...prev,
          [status]: { x, y, width, height },
        }));
      });
    });
  }, []);

  const loadTasks = useCallback(async () => {
    if (hasGroupContext && (!currentGroupId || !currentGroupName)) {
      setLoading(false);
      return;
    }

    if (hasMemberContext && !currentMemberId) {
      setLoading(false);
      setTasks([]);
      return;
    }

    if (!hasGroupContext && !hasMemberContext && !currentUserId) {
      setLoading(false);
      setTasks([]);
      return;
    }

    setLoading(true);
    try {
      const taskSnapPromise = getDocs(collection(db, "tasks"));
      const usersSnapPromise = getDocs(collection(db, "users"));
      const groupSnapPromise = hasGroupContext
        ? getDoc(doc(db, groupCollectionName, currentGroupId))
        : Promise.resolve(null);

      const [taskSnap, usersSnap, groupSnap] = await Promise.all([
        taskSnapPromise,
        usersSnapPromise,
        groupSnapPromise,
      ]);

      const userData: UserOption[] = usersSnap.docs
        .map((d) => {
          const raw = d.data() as any;
          return {
            id: d.id,
            name: String(
              raw?.name ??
                raw?.fullName ??
                raw?.memberName ??
                raw?.username ??
                raw?.email ??
                "Unnamed"
            ),
            role: String(raw?.role ?? ""),
            ministry: normalizeGroupArray(raw?.ministry),
            coreGroup: normalizeGroupArray(raw?.coreGroup ?? raw?.coreGroups),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const list: TaskItem[] = taskSnap.docs
        .map((d) => {
          const data = d.data() as TaskDoc;
          return {
            id: d.id,
            groupId: String(data.groupId ?? ""),
            groupName: String(data.groupName ?? ""),
            groupKind: String(data.groupKind ?? ""),
            title: String(data.title ?? "").trim(),
            description: String(data.description ?? "").trim(),
            checklist: normalizeChecklist(data.checklist),
            status: (data.status as TaskStatus) || "todo",
            order: Number(data.order ?? 0),
            deadline: String(data.deadline ?? ""),
            deadlineAt: data.deadlineAt,
            assignedMemberIds: Array.isArray(data.assignedMemberIds)
              ? data.assignedMemberIds.map((x) => String(x)).filter(Boolean)
              : [],
            assignedMemberNames: Array.isArray(data.assignedMemberNames)
              ? data.assignedMemberNames.map((x) => String(x)).filter(Boolean)
              : [],
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        })
        .filter((item) => item.title.length > 0)
        .filter((item) => {
          if (hasGroupContext) {
            return item.groupId === currentGroupId && item.groupName === currentGroupName;
          }

          if (hasMemberContext) {
            return item.assignedMemberIds.includes(currentMemberId);
          }

          return item.assignedMemberIds.includes(currentUserId);
        })
        .sort((a, b) => a.order - b.order);

      if (hasGroupContext) {
        const groupData = groupSnap?.data?.() as any;
        setGroupInfo({
          name: String(groupData?.name ?? currentGroupName ?? "Group"),
          description: String(groupData?.description ?? ""),
        });
      }

      setUsers(userData);
      setTasks(list);
    } catch {
      Alert.alert("Error", "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [
    currentGroupId,
    currentGroupName,
    currentGroupKind,
    currentMemberId,
    currentUserId,
    groupCollectionName,
    hasGroupContext,
    hasMemberContext,
  ]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  const eligibleUsers = useMemo(() => {
    if (!hasGroupContext) return [];
    const targetField = currentGroupKind === "ministry" ? "ministry" : "coreGroup";
    return users
      .filter((user) => {
        const hasGroup =
          targetField === "ministry"
            ? user.ministry.includes(currentGroupName)
            : user.coreGroup.includes(currentGroupName);
        return hasGroup || isAdminRole(user.role);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, currentGroupKind, currentGroupName, hasGroupContext]);

  const groupedTasks = useMemo(() => {
    const map: Record<TaskStatus, TaskItem[]> = {
      todo: [],
      doing: [],
      done: [],
    };

    tasks.forEach((task) => {
      map[task.status].push(task);
    });

    (Object.keys(map) as TaskStatus[]).forEach((key) => {
      map[key].sort((a, b) => a.order - b.order);
    });

    return map;
  }, [tasks]);

  const todoCount = groupedTasks.todo.length;
  const doingCount = groupedTasks.doing.length;
  const doneCount = groupedTasks.done.length;

  const resetTaskForm = () => {
    setEditingTaskId(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskChecklist([{ text: "", done: false }]);
    setSelectedStatus("todo");
    setSelectedMemberIds(hasMemberContext ? [currentMemberId] : []);
    setShowMemberDropdown(false);
    setDeadline(new Date());
    setShowDatePicker(false);
  };

  const openNewTaskModal = (status: TaskStatus = "todo") => {
    if (!canManageTasks) return;
    if (!hasGroupContext && !hasMemberContext) return;
    resetTaskForm();
    setSelectedStatus(status);
    if (hasMemberContext && currentMemberId) {
      setSelectedMemberIds([currentMemberId]);
    }
    setShowTaskModal(true);
  };

  const openEditTaskModal = (task: TaskItem) => {
    if (!canManageTasks) return;
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskDescription(task.description === "No description provided" ? "" : task.description);
    setTaskChecklist(
      task.checklist.length > 0 ? task.checklist : [{ text: "", done: false }]
    );
    setSelectedStatus(task.status);
    setSelectedMemberIds(task.assignedMemberIds ?? []);
    setShowMemberDropdown(false);
    if (task.deadlineAt && typeof task.deadlineAt.toDate === "function") {
      setDeadline(task.deadlineAt.toDate());
    } else if (task.deadline) {
      const parsed = new Date(task.deadline);
      if (!Number.isNaN(parsed.getTime())) setDeadline(parsed);
      else setDeadline(new Date());
    } else {
      setDeadline(new Date());
    }
    setShowDatePicker(false);
    setShowTaskModal(true);
  };

  const updateChecklistItem = (index: number, text: string) => {
    setTaskChecklist((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], text };
      return next;
    });
  };

  const removeChecklistItem = (index: number) => {
    setTaskChecklist((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ text: "", done: false }];
    });
  };

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const toggleChecklist = async (taskId: string, checklistIndex: number, nextDone: boolean) => {
    try {
      const targetTask = tasks.find((task) => task.id === taskId);
      if (!targetTask) return;

      const nextChecklist = targetTask.checklist.map((item, index) =>
        index === checklistIndex ? { ...item, done: nextDone } : item
      );

      await updateDoc(doc(db, "tasks", taskId), {
        checklist: nextChecklist,
        updatedAt: Timestamp.now(),
      });

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, checklist: nextChecklist } : task
        )
      );
    } catch {
      Alert.alert("Error", "Failed to update checklist");
    }
  };

  const saveTask = async () => {
    if (!canManageTasks) return;
    if (!hasGroupContext && !hasMemberContext) return;

    const title = taskTitle.trim();
    const description = taskDescription.trim() || "No description provided";

    if (hasGroupContext && (!currentGroupId || !currentGroupName)) {
      return Alert.alert("Error", "Missing group information");
    }

    if (!title) {
      return Alert.alert("Error", "Fill task title");
    }

    const cleanChecklist = taskChecklist
      .map((item) => ({
        text: item.text.trim(),
        done: !!item.done,
      }))
      .filter((item) => item.text.length > 0);

    const activeMemberIds =
      selectedMemberIds.length > 0
        ? selectedMemberIds
        : hasMemberContext && currentMemberId
          ? [currentMemberId]
          : [];

    const memberNames = activeMemberIds
      .map((id) => users.find((u) => u.id === id)?.name)
      .filter((name): name is string => Boolean(name));

    setSaving(true);
    try {
      const payload = {
        groupId: hasGroupContext ? currentGroupId : "",
        groupName: hasGroupContext ? currentGroupName : "",
        groupKind: hasGroupContext ? currentGroupKind : "",
        title,
        description,
        checklist: cleanChecklist,
        status: selectedStatus,
        deadline: deadline.toISOString().slice(0, 10),
        deadlineAt: Timestamp.fromDate(deadline),
        assignedMemberIds: activeMemberIds,
        assignedMemberNames: memberNames,
        updatedAt: Timestamp.now(),
      };

      if (editingTaskId) {
        await updateDoc(doc(db, "tasks", editingTaskId), payload);
      } else {
        const nextOrder = groupedTasks[selectedStatus].length;

        await addDoc(collection(db, "tasks"), {
          ...payload,
          order: nextOrder,
          createdAt: Timestamp.now(),
        });
      }

      setShowTaskModal(false);
      resetTaskForm();
      await loadTasks();
    } catch {
      Alert.alert("Error", "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!canManageTasks) return;

    Alert.alert("Delete task", "Remove this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "tasks", taskId));
            await loadTasks();
          } catch {
            Alert.alert("Error", "Failed to delete task");
          }
        },
      },
    ]);
  };

  const startDrag = useCallback(
    (task: TaskItem, x: number, y: number, width: number, height: number) => {
      measureColumns();
      setDragState({
        task,
        x: x - width / 2,
        y: y - height / 2,
        width,
        height,
      });
    },
    [measureColumns]
  );

  const moveDrag = useCallback((x: number, y: number) => {
    setDragState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        x: x - prev.width / 2,
        y: y - prev.height / 2,
      };
    });
  }, []);

  const endDrag = useCallback(
    async (x: number, y: number) => {
      const current = dragStateRef.current;
      if (!current) return;

      const rects = columnRectsRef.current;
      const targetStatus = (Object.keys(rects) as TaskStatus[]).find((status) => {
        const rect = rects[status];
        if (!rect) return false;
        return (
          x >= rect.x &&
          x <= rect.x + rect.width &&
          y >= rect.y &&
          y <= rect.y + rect.height
        );
      });

      setDragState(null);

      if (!targetStatus || targetStatus === current.task.status) {
        return;
      }

      try {
        const targetCount = groupedTasks[targetStatus].length;
        await updateDoc(doc(db, "tasks", current.task.id), {
          status: targetStatus,
          order: targetCount,
          updatedAt: Timestamp.now(),
        });
        await loadTasks();
      } catch {
        Alert.alert("Error", "Failed to move task");
      }
    },
    [groupedTasks, loadTasks]
  );

  const boardResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: () => !!dragStateRef.current,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: () => !!dragStateRef.current,
        onPanResponderMove: (evt) => {
          if (dragStateRef.current) {
            moveDrag(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
          }
        },
        onPanResponderRelease: (evt) => {
          if (dragStateRef.current) {
            endDrag(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
          }
        },
        onPanResponderTerminate: (evt) => {
          if (dragStateRef.current) {
            endDrag(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
          }
        },
      }),
    [endDrag, moveDrag]
  );

  const renderColumn = (status: TaskStatus, ref: React.RefObject<View>) => {
    const data = groupedTasks[status];
    const isDropTarget = (() => {
      if (!dragState) return false;
      const rect = columnRects[status];
      if (!rect) return false;
      const centerX = dragState.x + dragState.width / 2;
      const centerY = dragState.y + dragState.height / 2;
      return (
        centerX >= rect.x &&
        centerX <= rect.x + rect.width &&
        centerY >= rect.y &&
        centerY <= rect.y + rect.height
      );
    })();

    const count = status === "todo" ? todoCount : status === "doing" ? doingCount : doneCount;

    return (
      <View
        ref={ref}
        collapsable={false}
        onLayout={measureColumns}
        className={`w-[300px] min-h-[500px] rounded-[24px] border p-3 ${
          isDropTarget ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-slate-100/80"
        }`}
      >
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Text className="text-[18px] font-black text-slate-900">
              {status === "todo" ? "To Do" : status === "doing" ? "Doing" : "Done"}
            </Text>
            <View className="rounded-full bg-slate-900 px-2.5 py-1">
              <Text className="text-[11px] font-bold text-white">{count}</Text>
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
        >
          {data.length === 0 ? (
            <View className="items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-8">
              <View className="mb-2 h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                <Ionicons name="file-tray-outline" size={20} color="#94a3b8" />
              </View>
              <Text className="text-[13px] font-bold text-slate-500">No tasks yet</Text>
            </View>
          ) : null}

          {data.map((item) => (
            <TaskCard
              key={item.id}
              task={item}
              onOpen={openEditTaskModal}
              onDelete={canManageTasks ? deleteTask : undefined}
              onToggleChecklist={toggleChecklist}
              onStartDrag={startDrag}
              canManageTask={canManageTasks}
              showGroupMeta={!hasGroupContext}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <Text className="text-base font-semibold text-slate-900">Loading...</Text>
      </View>
    );
  }

  if (hasGroupContext && (!currentGroupId || !currentGroupName)) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <Text className="text-base font-semibold text-slate-900">Missing group</Text>
      </View>
    );
  }

  if (hasMemberContext && !currentMemberId) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <Text className="text-base font-semibold text-slate-900">Missing member</Text>
      </View>
    );
  }

  const selectedMemberNames = selectedMemberIds
    .map((id) => users.find((u) => u.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  const greetingName = currentMemberName || "Member";

  return (
    <View className="flex-1 bg-slate-50 pt-2" {...boardResponder.panHandlers}>
      <View className="px-4 pb-3">
        <View className="rounded-[24px] bg-white px-4 py-4 shadow-sm">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              {hasGroupContext ? (
                <>
                  <Text className="text-[28px] font-black leading-[34px] text-slate-900">
                    {groupInfo.name || currentGroupName}
                  </Text>
                  <Text className="mt-1 text-sm font-semibold leading-5 text-slate-500">
                    {groupInfo.description?.trim()
                      ? groupInfo.description
                      : "No description provided"}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-[28px] font-black leading-[34px] text-slate-900">
                    Tasks for {greetingName}
                  </Text>
                  <Text className="mt-1 text-sm font-semibold leading-5 text-slate-500">
                    Admin tasks assigned to this member
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, gap: 14 }}
      >
        {renderColumn("todo", todoColRef)}
        {renderColumn("doing", doingColRef)}
        {renderColumn("done", doneColRef)}
      </ScrollView>

      {canManageTasks && (hasGroupContext || hasMemberContext) ? (
        <Pressable
          onPress={() => openNewTaskModal("todo")}
          className="absolute bottom-5 right-5 h-[60px] w-[60px] items-center justify-center rounded-full bg-slate-900"
          style={({ pressed }) =>
            pressed
              ? {
                  opacity: 0.85,
                  transform: [{ scale: 0.98 }],
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 4 },
                }
              : {
                  shadowColor: "#000",
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 6,
                }
          }
        >
          <Ionicons name="add" size={32} color="white" />
        </Pressable>
      ) : null}

      {canManageTasks && (hasGroupContext || hasMemberContext) ? (
        <Modal
          visible={showTaskModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowTaskModal(false);
            resetTaskForm();
          }}
        >
          <View className="flex-1 justify-end">
            <Pressable
              className="absolute inset-0 bg-black/45"
              onPress={() => {
                setShowTaskModal(false);
                resetTaskForm();
              }}
            />
            <View className="max-h-[92%] rounded-t-[28px] bg-white px-[18px] pb-[18px] pt-2">
              <View className="mb-3 self-center h-[5px] w-[44px] rounded-full bg-slate-300" />
              <Text className="mb-3 text-center text-[22px] font-black text-slate-900">
                {editingTaskId ? "Edit Task" : "New Task"}
              </Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
              >
                <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 8 }}>
                  <Text className="text-[13px] font-extrabold text-slate-900">Title</Text>
                  <TextInput
                    value={taskTitle}
                    onChangeText={setTaskTitle}
                    placeholder="Task title"
                    placeholderTextColor="#94a3b8"
                    className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900"
                  />
                </View>

                <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 8 }}>
                  <Text className="text-[13px] font-extrabold text-slate-900">Description</Text>
                  <TextInput
                    value={taskDescription}
                    onChangeText={setTaskDescription}
                    placeholder="Write a short description"
                    placeholderTextColor="#94a3b8"
                    multiline
                    textAlignVertical="top"
                    className="min-h-[90px] rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900"
                  />
                </View>

                <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 8 }}>
                  <Text className="text-[13px] font-extrabold text-slate-900">Deadline</Text>
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    className="flex-row items-center rounded-[16px] border border-slate-200 bg-white px-4 py-3"
                    style={({ pressed }) =>
                      pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                    }
                  >
                    <Ionicons name="calendar-outline" size={18} color="#111827" />
                    <Text className="ml-2 text-[15px] font-bold text-slate-900">
                      {formatDateDisplay(deadline)}
                    </Text>
                  </Pressable>

                  {showDatePicker ? (
                    <DateTimePicker
                      value={deadline}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={(_, selected) => {
                        if (Platform.OS !== "ios") {
                          setShowDatePicker(false);
                        }
                        if (selected) setDeadline(selected);
                      }}
                    />
                  ) : null}
                </View>

                <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 8 }}>
                  <Text className="text-[13px] font-extrabold text-slate-900">Column</Text>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {statusList.map((status) => {
                      const active = selectedStatus === status.key;
                      return (
                        <Pressable
                          key={status.key}
                          onPress={() => setSelectedStatus(status.key)}
                          className={`rounded-full px-3 py-2 ${
                            active ? "bg-slate-900" : "bg-white"
                          }`}
                          style={({ pressed }) => [
                            pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined,
                            {
                              borderWidth: 1,
                              borderColor: active ? "#0f172a" : "#e2e8f0",
                            },
                          ]}
                        >
                          <Text
                            className={`text-xs font-extrabold ${
                              active ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {status.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 8 }}>
                  <Text className="text-[13px] font-extrabold text-slate-900">Checklist</Text>

                  {taskChecklist.map((item, index) => (
                    <View key={index} className="mb-2 flex-row items-center" style={{ gap: 10 }}>
                      <TextInput
                        value={item.text}
                        onChangeText={(text) => updateChecklistItem(index, text)}
                        placeholder={`Checklist ${index + 1}`}
                        placeholderTextColor="#94a3b8"
                        className="flex-1 rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900"
                      />
                      <Pressable
                        onPress={() => removeChecklistItem(index)}
                        className="h-10 w-10 items-center justify-center rounded-[14px] bg-red-500"
                        style={({ pressed }) =>
                          pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                        }
                      >
                        <Ionicons name="close" size={18} color="#fff" />
                      </Pressable>
                    </View>
                  ))}

                  <Pressable
                    onPress={() =>
                      setTaskChecklist((prev) => [...prev, { text: "", done: false }])
                    }
                    className="self-start flex-row items-center rounded-full bg-slate-900 px-4 py-2.5"
                    style={({ pressed }) =>
                      pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                    }
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text className="ml-2 font-bold text-white">Add checklist item</Text>
                  </Pressable>
                </View>

                <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 8 }}>
                  <Text className="text-[13px] font-extrabold text-slate-900">Assign Members</Text>

                  <Pressable
                    onPress={() => setShowMemberDropdown((prev) => !prev)}
                    className="flex-row items-center justify-between rounded-[16px] border border-slate-200 bg-white px-4 py-3"
                    style={({ pressed }) =>
                      pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                    }
                  >
                    <Text className="text-[15px] font-bold text-slate-900">
                      {selectedMemberNames.length > 0
                        ? `Selected Members (${selectedMemberNames.length})`
                        : "Select Members"}
                    </Text>
                    <Ionicons
                      name={showMemberDropdown ? "chevron-up" : "chevron-down"}
                      size={18}
                      color="#111827"
                    />
                  </Pressable>

                  {selectedMemberNames.length > 0 ? (
                    <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                      {selectedMemberNames.map((name, index) => (
                        <View
                          key={`${name}-${index}`}
                          className="flex-row items-center rounded-full bg-slate-200 px-3 py-1.5"
                          style={{ gap: 6 }}
                        >
                          <View className="h-4 w-4 items-center justify-center rounded-full bg-white">
                            <Ionicons name="person" size={11} color="#64748b" />
                          </View>
                          <Text className="text-xs font-bold text-slate-900">{name}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {showMemberDropdown ? (
                    hasGroupContext ? (
                      eligibleUsers.length === 0 ? (
                        <Text className="font-semibold text-slate-500">
                          No eligible members found
                        </Text>
                      ) : (
                        <View style={{ gap: 10 }}>
                          {eligibleUsers.map((member) => {
                            const checked = selectedMemberIds.includes(member.id);
                            return (
                              <Pressable
                                key={member.id}
                                onPress={() => toggleMember(member.id)}
                                className={`flex-row items-center rounded-[16px] border p-3 ${
                                  checked
                                    ? "border-blue-200 bg-blue-50"
                                    : "border-slate-200 bg-white"
                                }`}
                                style={({ pressed }) =>
                                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                                }
                              >
                                <View className="h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                                  <Ionicons name="person" size={16} color="#64748b" />
                                </View>

                                <View
                                  className={`mx-3 h-6 w-6 items-center justify-center rounded-full border-2 ${
                                    checked
                                      ? "border-slate-900 bg-slate-900"
                                      : "border-slate-300 bg-white"
                                  }`}
                                >
                                  {checked ? (
                                    <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                                  ) : null}
                                </View>

                                <View className="flex-1">
                                  <Text className="text-[15px] font-extrabold text-slate-900">
                                    {member.name}
                                  </Text>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      )
                    ) : hasMemberContext ? (
                      <View className="rounded-[16px] bg-white px-4 py-3">
                        <Text className="font-semibold text-slate-600">
                          This task will be assigned to {greetingName}
                        </Text>
                      </View>
                    ) : null
                  ) : null}
                </View>

                <View className="flex-row justify-end pt-1" style={{ gap: 10 }}>
                  <Pressable
                    onPress={() => {
                      setShowTaskModal(false);
                      resetTaskForm();
                    }}
                    className="rounded-[16px] bg-slate-200 px-4 py-3"
                    style={({ pressed }) =>
                      pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                    }
                  >
                    <Text className="font-extrabold text-slate-900">Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={saveTask}
                    disabled={saving}
                    className="rounded-[16px] bg-slate-900 px-4 py-3"
                    style={({ pressed }) => [
                      pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined,
                      saving ? { opacity: 0.75 } : null,
                    ]}
                  >
                    <Text className="font-extrabold text-white">
                      {editingTaskId ? "Update" : "Create"}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      {dragState ? (
        <Animated.View
          pointerEvents="none"
          className="absolute z-[9999]"
          style={{
            left: dragState.x,
            top: dragState.y,
            width: dragState.width,
            minHeight: dragState.height,
            elevation: 20,
          }}
        >
          <View
            className="rounded-2xl border border-slate-900 bg-white p-4"
            style={{
              gap: 8,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 12,
            }}
          >
            <Text className="text-base font-extrabold text-slate-900">
              {dragState.task.title}
            </Text>
            <Text className="text-[13px] leading-[18px] text-slate-600">
              {dragState.task.description || "No description provided"}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}