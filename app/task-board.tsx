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

type TaskCardProps = {
  task: TaskItem;
  onOpen: (task: TaskItem) => void;
  onDelete?: (taskId: string) => void;
  onToggleChecklist: (taskId: string, checklistIndex: number, nextDone: boolean) => void;
  onStartDrag: (task: TaskItem, x: number, y: number, width: number, height: number) => void;
  onMoveDrag: (x: number, y: number) => void;
  onEndDrag: (x: number, y: number) => void;
  isDragging: boolean;
  canManageTask: boolean;
  showGroupMeta: boolean;
};

function TaskCard({
  task,
  onOpen,
  onDelete,
  onToggleChecklist,
  onStartDrag,
  onMoveDrag,
  onEndDrag,
  isDragging,
  canManageTask,
  showGroupMeta,
}: TaskCardProps) {
  const [layout, setLayout] = useState({ width: 300, height: 120 });
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressReady = useRef(false);
  const moved = useRef(false);
  const lastTouch = useRef({ x: 0, y: 0 });
  const suppressOpen = useRef(false);

  const clearTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const blockOpenBriefly = () => {
    suppressOpen.current = true;
    setTimeout(() => {
      suppressOpen.current = false;
    }, 150);
  };

  useEffect(() => {
    if (!isDragging) {
      longPressReady.current = false;
      moved.current = false;
      clearTimer();
    }
  }, [isDragging]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          moved.current = false;
          longPressReady.current = false;
          lastTouch.current = {
            x: evt.nativeEvent.pageX,
            y: evt.nativeEvent.pageY,
          };

          clearTimer();
          pressTimer.current = setTimeout(() => {
            longPressReady.current = true;
            onStartDrag(
              task,
              lastTouch.current.x,
              lastTouch.current.y,
              layout.width || 300,
              layout.height || 120
            );
          }, 500);
        },
        onPanResponderMove: (evt, gestureState) => {
          lastTouch.current = {
            x: evt.nativeEvent.pageX,
            y: evt.nativeEvent.pageY,
          };

          if (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4) {
            moved.current = true;
          }

          if (longPressReady.current) {
            onMoveDrag(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
          }
        },
        onPanResponderRelease: (evt) => {
          clearTimer();

          if (longPressReady.current) {
            onEndDrag(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
            longPressReady.current = false;
            return;
          }

          if (!moved.current && !suppressOpen.current && canManageTask) {
            onOpen(task);
          }
        },
        onPanResponderTerminate: (evt) => {
          clearTimer();

          if (longPressReady.current) {
            onEndDrag(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
            longPressReady.current = false;
          }
        },
      }),
    [canManageTask, layout.height, layout.width, onEndDrag, onMoveDrag, onOpen, onStartDrag, task]
  );

  const checklistDone = task.checklist.filter((x) => x.done).length;
  const checklistTotal = task.checklist.length;
  const descriptionText =
    task.description && task.description.trim()
      ? task.description
      : "No description provided";

  return (
    <Animated.View
      {...responder.panHandlers}
      onLayout={(e) =>
        setLayout({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        })
      }
      className={`rounded-2xl border border-slate-200 bg-white p-4 ${isDragging ? "opacity-25" : ""}`}
      style={{ gap: 10 }}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1" style={{ gap: 4 }}>
          <Text className="text-base font-extrabold text-slate-900">{task.title}</Text>
          {showGroupMeta ? (
            <Text className="text-xs font-bold text-slate-500">
              {task.groupName || "Group"}
            </Text>
          ) : null}
        </View>

        {canManageTask && onDelete ? (
          <Pressable
            onPressIn={blockOpenBriefly}
            onPress={() => onDelete(task.id)}
            className="h-[30px] w-[30px] items-center justify-center rounded-full bg-slate-100"
          >
            <Ionicons name="trash-outline" size={18} color="#991B1B" />
          </Pressable>
        ) : null}
      </View>

      <Text className="text-[13px] leading-[18px] text-slate-600">{descriptionText}</Text>

      {checklistTotal > 0 ? (
        <Text className="text-xs font-bold text-slate-500">
          Checklist {checklistDone}/{checklistTotal}
        </Text>
      ) : null}

      {task.checklist.length > 0 ? (
        <View style={{ gap: 8 }}>
          {task.checklist.map((item, index) => (
            <Pressable
              key={`${task.id}-check-${index}`}
              onPressIn={blockOpenBriefly}
              onPress={() => onToggleChecklist(task.id, index, !item.done)}
              className="flex-row items-center py-1"
              style={({ pressed }) => [
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                { gap: 8 },
              ]}
            >
              <View
                className={`h-5 w-5 items-center justify-center rounded-md border bg-white ${
                  item.done ? "border-slate-900 bg-slate-900" : "border-slate-400"
                }`}
              >
                {item.done ? <Text className="text-[13px] font-extrabold text-white">✓</Text> : null}
              </View>
              <Text
                className={`flex-1 text-[13px] font-semibold ${
                  item.done ? "text-slate-500 line-through" : "text-slate-900"
                }`}
              >
                {item.text}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {task.assignedMemberNames.length > 0 ? (
        <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
          {task.assignedMemberNames.slice(0, 3).map((name, index) => (
            <View
              key={`${name}-${index}`}
              className="flex-row items-center rounded-full bg-slate-200 px-3 py-1.5"
              style={{ gap: 6 }}
            >
              <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-slate-100">
                <Ionicons name="person" size={12} color="#6B7280" />
              </View>
              <Text className="text-xs font-bold text-slate-900">{name}</Text>
            </View>
          ))}
          {task.assignedMemberNames.length > 3 ? (
            <Text className="text-xs font-bold text-slate-500">
              +{task.assignedMemberNames.length - 3}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: 2 }}>
        <Text className="text-xs font-extrabold text-slate-900">Deadline:</Text>
        <Text className="text-xs font-bold text-slate-500">
          {task.deadline || "No deadline"}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function TaskBoard({ userId, userRole, memberName, targetMemberId, targetMemberName }: TaskBoardProps) {
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
  const currentMemberName = String(targetMemberName ?? params.memberName ?? params.name ?? memberName ?? "Member");
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
  }, [currentGroupId, currentGroupName, currentGroupKind, currentMemberId, currentUserId, groupCollectionName, hasGroupContext, hasMemberContext]);

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

  const resetTaskForm = () => {
    setEditingTaskId(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskChecklist([{ text: "", done: false }]);
    setSelectedStatus("todo");
    setSelectedMemberIds([]);
    setShowMemberDropdown(false);
    setDeadline(new Date());
    setShowDatePicker(false);
  };

  const openNewTaskModal = (status: TaskStatus = "todo") => {
    if (!canManageTasks) return;
    if (!hasGroupContext) return;
    resetTaskForm();
    setSelectedStatus(status);
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
    if (!hasGroupContext) return;

    const title = taskTitle.trim();
    const description = taskDescription.trim() || "No description provided";

    if (!currentGroupId || !currentGroupName) {
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

    const memberNames = selectedMemberIds
      .map((id) => users.find((u) => u.id === id)?.name)
      .filter((name): name is string => Boolean(name));

    setSaving(true);
    try {
      const payload = {
        groupId: currentGroupId,
        groupName: currentGroupName,
        groupKind: currentGroupKind,
        title,
        description,
        checklist: cleanChecklist,
        status: selectedStatus,
        deadline: deadline.toISOString().slice(0, 10),
        deadlineAt: Timestamp.fromDate(deadline),
        assignedMemberIds: selectedMemberIds,
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

    return (
      <View
        ref={ref}
        collapsable={false}
        onLayout={measureColumns}
        className={`w-[300px] rounded-[20px] p-3 min-h-[500px] bg-slate-100 ${
          isDropTarget ? "border-2 border-slate-900" : ""
        }`}
      >
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-extrabold text-slate-900">
              {status === "todo" ? "To Do" : status === "doing" ? "Doing" : "Done"}
            </Text>
            <Text className="mt-0.5 text-xs font-semibold text-slate-500">
              {status === "todo"
                ? "Backlog"
                : status === "doing"
                  ? "In progress"
                  : "Completed"}
            </Text>
          </View>

          {canManageTasks && hasGroupContext ? (
            <Pressable
              onPress={() => openNewTaskModal(status)}
              className="h-[34px] w-[34px] items-center justify-center rounded-full border border-slate-200 bg-white"
              style={({ pressed }) =>
                pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
              }
            >
              <Ionicons name="add" size={18} color="#111827" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-5"
          contentContainerStyle={{ gap: 12 }}
        >
          {data.length === 0 ? (
            <View className="items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-5">
              <Text className="text-[13px] font-bold text-slate-500">No tasks</Text>
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
              onMoveDrag={moveDrag}
              onEndDrag={endDrag}
              isDragging={dragState?.task.id === item.id}
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
    <View className="flex-1 bg-slate-50 pt-2">
      <View className="flex-row items-start gap-3 px-4 pb-3">
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
            <Text className="text-2xl font-black leading-8 text-slate-900">
              Tasks for {greetingName}
            </Text>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-4 pb-28"
        contentContainerStyle={{ gap: 14 }}
      >
        {renderColumn("todo", todoColRef)}
        {renderColumn("doing", doingColRef)}
        {renderColumn("done", doneColRef)}
      </ScrollView>

      {canManageTasks && hasGroupContext ? (
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

      {canManageTasks && hasGroupContext ? (
        <Modal
          visible={showTaskModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowTaskModal(false);
            resetTaskForm();
          }}
        >
          <Pressable
            className="flex-1 justify-end bg-black/45"
            onPress={() => {
              setShowTaskModal(false);
              resetTaskForm();
            }}
          >
            <Pressable
              className="max-h-[92%] rounded-t-[24px] bg-white px-[18px] pb-[18px] pt-2"
              onPress={() => {}}
            >
              <View className="mb-3 self-center h-[5px] w-[44px] rounded-full bg-slate-300" />
              <Text className="mb-3 text-center text-xl font-extrabold text-slate-900">
                {editingTaskId ? "Edit Task" : "New Task"}
              </Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerClassName="pb-2"
                contentContainerStyle={{ gap: 12 }}
              >
                <View style={{ gap: 8 }}>
                  <Text className="text-[13px] font-extrabold text-slate-900">Title</Text>
                  <TextInput
                    value={taskTitle}
                    onChangeText={setTaskTitle}
                    placeholder="Task title"
                    className="rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900"
                  />
                </View>

                <View style={{ gap: 8 }}>
                  <Text className="text-[13px] font-extrabold text-slate-900">Description</Text>
                  <TextInput
                    value={taskDescription}
                    onChangeText={setTaskDescription}
                    placeholder="Write a short description"
                    multiline
                    textAlignVertical="top"
                    className="min-h-[90px] rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900"
                  />
                </View>

                <View style={{ gap: 8 }}>
                  <Text className="text-[13px] font-extrabold text-slate-900">Deadline</Text>
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    className="flex-row items-center rounded-[14px] border border-slate-200 bg-white px-4 py-3"
                    style={({ pressed }) =>
                      pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                    }
                  >
                    <Ionicons name="calendar-outline" size={18} color="#111827" />
                    <Text className="ml-2 text-[15px] font-bold text-slate-900">
                      {deadline.toISOString().slice(0, 10)}
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

                <View style={{ gap: 8 }}>
                  <Text className="text-[13px] font-extrabold text-slate-900">Column</Text>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {statusList.map((status) => {
                      const active = selectedStatus === status.key;
                      return (
                        <Pressable
                          key={status.key}
                          onPress={() => setSelectedStatus(status.key)}
                          className={`rounded-full px-3 py-2 ${
                            active ? "bg-slate-900" : "bg-slate-200"
                          }`}
                          style={({ pressed }) =>
                            pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                          }
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

                <View style={{ gap: 8 }}>
                  <Text className="text-[13px] font-extrabold text-slate-900">Checklist</Text>
                  {taskChecklist.map((item, index) => (
                    <View key={index} className="mb-2 flex-row items-center" style={{ gap: 8 }}>
                      <TextInput
                        value={item.text}
                        onChangeText={(text) => updateChecklistItem(index, text)}
                        placeholder={`Checklist ${index + 1}`}
                        className="flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900"
                      />
                      <Pressable
                        onPress={() => removeChecklistItem(index)}
                        className="h-10 w-10 items-center justify-center rounded-xl bg-red-500"
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

                <View style={{ gap: 8 }}>
                  <Text className="text-[13px] font-extrabold text-slate-900">Assign Members</Text>

                  <Pressable
                    onPress={() => setShowMemberDropdown((prev) => !prev)}
                    className="flex-row items-center justify-between rounded-[14px] border border-slate-200 bg-white px-4 py-3"
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
                          <View className="h-4 w-4 items-center justify-center rounded-full bg-slate-100">
                            <Ionicons name="person" size={11} color="#6B7280" />
                          </View>
                          <Text className="text-xs font-bold text-slate-900">{name}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {showMemberDropdown ? (
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
                              className={`flex-row items-center rounded-[14px] border p-3 ${
                                checked
                                  ? "border-blue-200 bg-blue-50"
                                  : "border-slate-200 bg-white"
                              }`}
                              style={({ pressed }) =>
                                pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                              }
                            >
                              <View className="h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                                <Ionicons name="person" size={16} color="#6B7280" />
                              </View>
                              <View
                                className={`mx-2 h-[22px] w-[22px] items-center justify-center rounded-md border ${
                                  checked
                                    ? "border-slate-900 bg-slate-900"
                                    : "border-slate-400 bg-white"
                                }`}
                              >
                                {checked ? (
                                  <Text className="text-sm font-bold text-white">✓</Text>
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
                  ) : null}
                </View>

                <View className="flex-row justify-end pt-1" style={{ gap: 10 }}>
                  <Pressable
                    onPress={() => {
                      setShowTaskModal(false);
                      resetTaskForm();
                    }}
                    className="rounded-[14px] bg-slate-200 px-4 py-3"
                    style={({ pressed }) =>
                      pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                    }
                  >
                    <Text className="font-extrabold text-slate-900">Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={saveTask}
                    disabled={saving}
                    className="rounded-[14px] bg-slate-900 px-4 py-3"
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
            </Pressable>
          </Pressable>
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