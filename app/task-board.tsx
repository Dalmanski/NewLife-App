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
  StyleSheet,
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
      style={[styles.card, isDragging && styles.cardDragging]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{task.title}</Text>
          {showGroupMeta ? <Text style={styles.groupMetaText}>{task.groupName || "Group"}</Text> : null}
        </View>

        {canManageTask && onDelete ? (
          <Pressable
            onPressIn={blockOpenBriefly}
            onPress={() => onDelete(task.id)}
            style={styles.iconBtn}
          >
            <Ionicons name="trash-outline" size={18} color="#991B1B" />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.cardDescription}>{descriptionText}</Text>

      {checklistTotal > 0 ? (
        <Text style={styles.metaText}>
          Checklist {checklistDone}/{checklistTotal}
        </Text>
      ) : null}

      {task.checklist.length > 0 ? (
        <View style={styles.checklistWrap}>
          {task.checklist.map((item, index) => (
            <Pressable
              key={`${task.id}-check-${index}`}
              onPressIn={blockOpenBriefly}
              onPress={() => onToggleChecklist(task.id, index, !item.done)}
              style={({ pressed }) => [styles.checklistRow, pressed && styles.pressed]}
            >
              <View style={[styles.checkBoxMini, item.done && styles.checkBoxMiniActive]}>
                {item.done ? <Text style={styles.checkTextMini}>✓</Text> : null}
              </View>
              <Text style={[styles.checklistText, item.done && styles.checklistTextDone]}>
                {item.text}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {task.assignedMemberNames.length > 0 ? (
        <View style={styles.assigneeWrap}>
          {task.assignedMemberNames.slice(0, 3).map((name, index) => (
            <View key={`${name}-${index}`} style={styles.assigneeChip}>
              <View style={styles.pfpPlaceholder}>
                <Ionicons name="person" size={12} color="#6B7280" />
              </View>
              <Text style={styles.assigneeChipText}>{name}</Text>
            </View>
          ))}
          {task.assignedMemberNames.length > 3 ? (
            <Text style={styles.moreAssignees}>
              +{task.assignedMemberNames.length - 3}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.deadlineBlock}>
        <Text style={styles.deadlineLabel}>Deadline:</Text>
        <Text style={styles.deadlineValue}>{task.deadline || "No deadline"}</Text>
      </View>
    </Animated.View>
  );
}

export default function TaskBoard({ userId, userRole, memberName }: TaskBoardProps) {
  const params = useLocalSearchParams<{
    groupId?: string;
    groupName?: string;
    groupKind?: string;
    id?: string;
    userRole?: string;
  }>();

  const currentGroupId = String(params.groupId ?? "");
  const currentGroupName = String(params.groupName ?? "");
  const currentGroupKind = String(params.groupKind ?? "");
  const groupCollectionName = currentGroupKind === "coreGroup" ? "coreGroups" : "ministries";

  const currentUserId = String(userId ?? params.id ?? "");
  const fallbackMemberName = String(memberName ?? "Member");
  const initialRole = String(userRole ?? params.userRole ?? "");

  const isMemberView = !currentGroupId || !currentGroupName;

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
    if (!isMemberView && (!currentGroupId || !currentGroupName)) {
      setLoading(false);
      return;
    }

    if (isMemberView && !currentUserId) {
      setLoading(false);
      setTasks([]);
      return;
    }

    setLoading(true);
    try {
      const taskSnapPromise = getDocs(collection(db, "tasks"));
      const usersSnapPromise = getDocs(collection(db, "users"));
      const groupSnapPromise = isMemberView
        ? Promise.resolve(null)
        : getDoc(doc(db, groupCollectionName, currentGroupId));

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
          if (isMemberView) {
            return item.assignedMemberIds.includes(currentUserId);
          }
          return item.groupId === currentGroupId && item.groupName === currentGroupName;
        })
        .sort((a, b) => a.order - b.order);

      if (!isMemberView) {
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
  }, [currentGroupId, currentGroupName, currentGroupKind, currentUserId, groupCollectionName, isMemberView]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  const eligibleUsers = useMemo(() => {
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
  }, [users, currentGroupKind, currentGroupName]);

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
        onLayout={measureColumns}
        style={[styles.column, isDropTarget && styles.columnActiveDrop]}
      >
        <View style={styles.columnHeader}>
          <View>
            <Text style={styles.columnTitle}>
              {status === "todo" ? "To Do" : status === "doing" ? "Doing" : "Done"}
            </Text>
            <Text style={styles.columnHint}>
              {status === "todo"
                ? "Backlog"
                : status === "doing"
                  ? "In progress"
                  : "Completed"}
            </Text>
          </View>

          {canManageTasks ? (
            <Pressable
              onPress={() => openNewTaskModal(status)}
              style={({ pressed }) => [styles.addInlineBtn, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={18} color="#111827" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
        >
          {data.length === 0 ? (
            <View style={styles.emptyColumn}>
              <Text style={styles.emptyColumnText}>No tasks</Text>
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
              showGroupMeta={isMemberView}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!isMemberView && (!currentGroupId || !currentGroupName)) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>Missing group</Text>
      </View>
    );
  }

  const selectedMemberNames = selectedMemberIds
    .map((id) => users.find((u) => u.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  const greetingName = fallbackMemberName || "Member";

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          {isMemberView ? (
            <Text style={styles.memberGreeting}>Hi {greetingName}! Here is your task!</Text>
          ) : (
            <>
              <Text style={styles.title}>{groupInfo.name || currentGroupName}</Text>
              <Text style={styles.subtitle}>
                {groupInfo.description?.trim()
                  ? groupInfo.description
                  : "No description provided"}
              </Text>
            </>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.board}
      >
        {renderColumn("todo", todoColRef)}
        {renderColumn("doing", doingColRef)}
        {renderColumn("done", doneColRef)}
      </ScrollView>

      {canManageTasks ? (
        <Pressable
          onPress={() => openNewTaskModal("todo")}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={32} color="white" />
        </Pressable>
      ) : null}

      {canManageTasks ? (
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
            style={styles.backdrop}
            onPress={() => {
              setShowTaskModal(false);
              resetTaskForm();
            }}
          >
            <Pressable style={styles.sheet} onPress={() => {}}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>
                {editingTaskId ? "Edit Task" : "New Task"}
              </Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sheetContent}
              >
                <View style={styles.field}>
                  <Text style={styles.label}>Title</Text>
                  <TextInput
                    value={taskTitle}
                    onChangeText={setTaskTitle}
                    placeholder="Task title"
                    style={styles.input}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    value={taskDescription}
                    onChangeText={setTaskDescription}
                    placeholder="Write a short description"
                    multiline
                    textAlignVertical="top"
                    style={[styles.input, styles.textArea]}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Deadline</Text>
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    style={({ pressed }) => [styles.dateBtn, pressed && styles.pressed]}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#111827" />
                    <Text style={styles.dateBtnText}>{deadline.toISOString().slice(0, 10)}</Text>
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

                <View style={styles.field}>
                  <Text style={styles.label}>Column</Text>
                  <View style={styles.statusRow}>
                    {statusList.map((status) => {
                      const active = selectedStatus === status.key;
                      return (
                        <Pressable
                          key={status.key}
                          onPress={() => setSelectedStatus(status.key)}
                          style={({ pressed }) => [
                            styles.statusChip,
                            active && styles.statusChipActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusChipText,
                              active && styles.statusChipTextActive,
                            ]}
                          >
                            {status.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Checklist</Text>
                  {taskChecklist.map((item, index) => (
                    <View key={index} style={styles.checklistRowEditor}>
                      <TextInput
                        value={item.text}
                        onChangeText={(text) => updateChecklistItem(index, text)}
                        placeholder={`Checklist ${index + 1}`}
                        style={[styles.input, styles.checklistInput]}
                      />
                      <Pressable
                        onPress={() => removeChecklistItem(index)}
                        style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                      >
                        <Ionicons name="close" size={18} color="#fff" />
                      </Pressable>
                    </View>
                  ))}

                  <Pressable
                    onPress={() =>
                      setTaskChecklist((prev) => [...prev, { text: "", done: false }])
                    }
                    style={({ pressed }) => [styles.addChecklistBtn, pressed && styles.pressed]}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={styles.addChecklistText}>Add checklist item</Text>
                  </Pressable>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Assign Members</Text>

                  <Pressable
                    onPress={() => setShowMemberDropdown((prev) => !prev)}
                    style={({ pressed }) => [styles.selectMembersBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.selectMembersBtnText}>
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
                    <View style={styles.selectedMemberWrap}>
                      {selectedMemberNames.map((name, index) => (
                        <View key={`${name}-${index}`} style={styles.selectedMemberChip}>
                          <View style={styles.pfpPlaceholderSmall}>
                            <Ionicons name="person" size={11} color="#6B7280" />
                          </View>
                          <Text style={styles.selectedMemberChipText}>{name}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {showMemberDropdown ? (
                    eligibleUsers.length === 0 ? (
                      <Text style={styles.emptyAssigneeText}>No eligible members found</Text>
                    ) : (
                      <View style={styles.assigneeList}>
                        {eligibleUsers.map((member) => {
                          const checked = selectedMemberIds.includes(member.id);
                          return (
                            <Pressable
                              key={member.id}
                              onPress={() => toggleMember(member.id)}
                              style={({ pressed }) => [
                                styles.assigneeRow,
                                checked && styles.assigneeRowActive,
                                pressed && styles.pressed,
                              ]}
                            >
                              <View style={styles.pfpPlaceholderLarge}>
                                <Ionicons name="person" size={16} color="#6B7280" />
                              </View>
                              <View style={[styles.checkBox, checked && styles.checkBoxActive]}>
                                {checked ? <Text style={styles.checkText}>✓</Text> : null}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.assigneeName}>{member.name}</Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    )
                  ) : null}
                </View>

                <View style={styles.sheetActions}>
                  <Pressable
                    onPress={() => {
                      setShowTaskModal(false);
                      resetTaskForm();
                    }}
                    style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={saveTask}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.saveBtn,
                      pressed && styles.pressed,
                      saving && { opacity: 0.75 },
                    ]}
                  >
                    <Text style={styles.saveBtnText}>
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
          style={[
            styles.dragOverlay,
            {
              left: dragState.x,
              top: dragState.y,
              width: dragState.width,
              minHeight: dragState.height,
            },
          ]}
        >
          <View style={styles.dragOverlayInner}>
            <Text style={styles.dragOverlayTitle}>{dragState.task.title}</Text>
            <Text style={styles.dragOverlayText}>
              {dragState.task.description || "No description provided"}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    paddingTop: 10,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7F8FA",
  },
  loadingText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111827",
    lineHeight: 34,
  },
  memberGreeting: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
    lineHeight: 32,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    lineHeight: 20,
  },
  board: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 14,
  },
  column: {
    width: 300,
    backgroundColor: "#EEF2F7",
    borderRadius: 20,
    padding: 12,
    minHeight: 500,
  },
  columnActiveDrop: {
    borderWidth: 2,
    borderColor: "#111827",
  },
  columnHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  columnTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  columnHint: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  addInlineBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyColumn: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
  },
  emptyColumnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 10,
  },
  cardDragging: {
    opacity: 0.25,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  groupMetaText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  cardDescription: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  checklistWrap: {
    gap: 8,
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  checkBoxMini: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#9CA3AF",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  checkBoxMiniActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  checkTextMini: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  checklistText: {
    flex: 1,
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
  },
  checklistTextDone: {
    color: "#6B7280",
    textDecorationLine: "line-through",
  },
  assigneeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  assigneeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  pfpPlaceholder: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  pfpPlaceholderSmall: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  pfpPlaceholderLarge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  assigneeChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  moreAssignees: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  deadlineBlock: {
    gap: 2,
  },
  deadlineLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
  },
  deadlineValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
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
    maxHeight: "92%",
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
  field: {
    gap: 8,
  },
  label: {
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
    minHeight: 90,
  },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  dateBtnText: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  statusChipActive: {
    backgroundColor: "#111827",
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
  },
  statusChipTextActive: {
    color: "#fff",
  },
  checklistRowEditor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  checklistInput: {
    flex: 1,
  },
  removeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  addChecklistBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#111827",
  },
  addChecklistText: {
    color: "#fff",
    fontWeight: "700",
  },
  emptyAssigneeText: {
    color: "#6B7280",
    fontWeight: "600",
  },
  selectMembersBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  selectMembersBtnText: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "700",
  },
  selectedMemberWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  selectedMemberChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  selectedMemberChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  assigneeList: {
    gap: 10,
  },
  assigneeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#fff",
  },
  assigneeRowActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#9CA3AF",
    justifyContent: "center",
    alignItems: "center",
  },
  checkBoxActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  checkText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  assigneeName: {
    fontWeight: "800",
    color: "#111827",
    fontSize: 15,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    paddingTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
  },
  cancelBtnText: {
    fontWeight: "800",
    color: "#111827",
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#111827",
  },
  saveBtnText: {
    fontWeight: "800",
    color: "#fff",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  dragOverlay: {
    position: "absolute",
    zIndex: 9999,
    elevation: 20,
  },
  dragOverlayInner: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#111827",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    gap: 8,
  },
  dragOverlayTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  dragOverlayText: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
  },
});