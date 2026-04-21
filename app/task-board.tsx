import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { db } from "../lib/firebaseConfig";
import {
  DeleteConfirmModal,
  ListModal,
  TaskActionMenuModal,
  TaskModal,
} from "./task-board-modal";

type TaskStatus = string;

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
  showChecklist?: boolean;
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
  showChecklist: boolean;
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

type CardRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type GroupInfo = {
  name: string;
  description: string;
};

type BoardColumn = {
  id: string;
  label: string;
};

type TaskBoardProps = {
  userId?: string;
  userRole?: string;
  memberName?: string;
  targetMemberId?: string;
  targetMemberName?: string;
};

type MenuAnchor = {
  taskId: string;
  x: number;
  y: number;
};

const defaultColumnLabels = ["To Do", "Pending", "Done"];

const defaultColumns: BoardColumn[] = defaultColumnLabels.map((label) => ({
  id: label.toLowerCase().replace(/\s+/g, ""),
  label,
}));

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

const normalizeRole = (value: unknown) => String(value ?? "").trim().toLowerCase();

const isAdminRole = (role: string) => role.includes("admin");

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

const createColumnId = () => {
  return `list-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
};

const normalizeColumns = (value: unknown): BoardColumn[] => {
  if (!Array.isArray(value)) return defaultColumns;

  const next: BoardColumn[] = [];
  const seen = new Set<string>();

  value.forEach((item) => {
    let label = "";
    let id = "";

    if (typeof item === "string") {
      label = String(item ?? "").trim();
      if (!label) return;
    } else if (item && typeof item === "object") {
      const raw = item as any;
      label = String(raw?.label ?? raw?.name ?? "").trim();
      id = String(raw?.id ?? raw?.key ?? "").trim();
      if (!label) return;
    }

    if (!id) {
      const normalized = label.toLowerCase();
      const defaultCol = defaultColumns.find((col) => col.label.toLowerCase() === normalized);
      id = defaultCol?.id || createColumnId();
    }

    if (!seen.has(id)) {
      seen.add(id);
      next.push({ id, label });
    }
  });

  return next.length > 0 ? next : defaultColumns;
};

const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

const renderDescriptionWithLinks = (text: string, onLinkPress: (url: string) => void) => {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  urlRegex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const start = match.index;

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    nodes.push(
      <Text
        key={`${start}-${url}`}
        selectable={false}
        onPress={() => onLinkPress(url)}
        className="font-bold text-blue-600"
        style={{
          textDecorationLine: "underline",
        }}
      >
        {url}
      </Text>
    );

    lastIndex = start + url.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : text;
};

type TaskCardProps = {
  task: TaskItem;
  onDelete?: (taskId: string) => void;
  onEdit: (task: TaskItem) => void;
  onToggleChecklist: (taskId: string, checklistIndex: number, nextDone: boolean) => void;
  onStartDrag: (task: TaskItem, x: number, y: number, width: number, height: number) => void;
  canManageTask: boolean;
  showGroupMeta: boolean;
  onMeasure: (taskId: string, rect: CardRect) => void;
  onOpenMenu: (taskId: string, x: number, y: number) => void;
  menuOpenTaskId: string | null;
};

function TaskCard({
  task,
  onDelete,
  onEdit,
  onToggleChecklist,
  onStartDrag,
  canManageTask,
  showGroupMeta,
  onMeasure,
  onOpenMenu,
  menuOpenTaskId,
}: TaskCardProps) {
  const [layout, setLayout] = useState({ width: 300, height: 120 });
  const [showChecklist, setShowChecklist] = useState(!!task.showChecklist);
  const suppressOpen = useRef(false);
  const cardRef = useRef<any>(null);

  useEffect(() => {
    setShowChecklist(!!task.showChecklist);
  }, [task.showChecklist, task.id]);

  const blockOpenBriefly = () => {
    suppressOpen.current = true;
    setTimeout(() => {
      suppressOpen.current = false;
    }, 150);
  };

  const measureCard = useCallback(() => {
    requestAnimationFrame(() => {
      cardRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
        onMeasure(task.id, { x, y, width, height });
      });
    });
  }, [onMeasure, task.id]);

  const checklistDone = task.checklist.filter((x) => x.done).length;
  const checklistTotal = task.checklist.length;
  const descriptionText =
    task.description && task.description.trim() ? task.description : "No description provided";
  const formattedDeadline = formatDeadlineText(task.deadline, task.deadlineAt);

  const openUrl = async (url: string) => {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    try {
      await Linking.openURL(normalized);
    } catch {
      Alert.alert("Error", "Unable to open link");
    }
  };

  return (
    <Pressable
      ref={cardRef}
      onLayout={(e) => {
        setLayout({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        });
        measureCard();
      }}
      onLongPress={(evt) => {
        blockOpenBriefly();
        onOpenMenu(task.id, evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        onStartDrag(
          task,
          evt.nativeEvent.pageX,
          evt.nativeEvent.pageY,
          layout.width || 300,
          layout.height || 120
        );
      }}
      delayLongPress={500}
      className="rounded-[22px] border border-slate-200 bg-white p-4"
      style={{
        position: "relative",
        overflow: "visible",
        zIndex: menuOpenTaskId === task.id ? 999 : 1,
        gap: 12,
        shadowColor: "#0f172a",
        shadowOpacity: 0.06,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: menuOpenTaskId === task.id ? 10 : 2,
        cursor: "default",
      }}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1" style={{ gap: 6 }}>
          <Text selectable={false} className="text-[16px] font-extrabold leading-5 text-slate-900">
            {task.title}
          </Text>

          {showGroupMeta ? (
            <View className="self-start rounded-full bg-slate-100 px-2.5 py-1">
              <Text selectable={false} className="text-[11px] font-bold text-slate-500">
                {task.groupName || "Group"}
              </Text>
            </View>
          ) : null}
        </View>

        {canManageTask ? (
          <View style={{ position: "relative", zIndex: 1000 }}>
            <Pressable
              onPressIn={blockOpenBriefly}
              onPress={(evt) => onOpenMenu(task.id, evt.nativeEvent.pageX, evt.nativeEvent.pageY)}
              className="h-8 w-8 items-center justify-center rounded-full bg-slate-100"
              hitSlop={8}
              style={{
                zIndex: 1000,
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color="#0f172a" />
            </Pressable>
          </View>
        ) : null}
      </View>

      <Text selectable={false} className="text-[13px] leading-[19px] text-slate-600">
        {renderDescriptionWithLinks(descriptionText, openUrl)}
      </Text>

      <View style={{ gap: 10 }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Pressable
              onPressIn={blockOpenBriefly}
              onPress={() => setShowChecklist((prev) => !prev)}
              className="rounded-full bg-slate-100 px-2.5 py-1"
              style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
            >
              <Text selectable={false} className="text-[11px] font-bold text-slate-600">
                Checklist {checklistDone}/{checklistTotal}
              </Text>
            </Pressable>
          </View>

          <View className="flex-row items-center" style={{ gap: 8 }}>
            {formattedDeadline ? (
              <View className="rounded-full bg-amber-50 px-2.5 py-1">
                <Text selectable={false} className="text-[11px] font-bold text-amber-700">
                  Due {formattedDeadline}
                </Text>
              </View>
            ) : (
              <View className="rounded-full bg-slate-100 px-2.5 py-1">
                <Text selectable={false} className="text-[11px] font-bold text-slate-500">
                  No deadline
                </Text>
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
                    item.done ? "border-slate-900 bg-slate-900" : "border-slate-300 bg-white"
                  }`}
                >
                  {item.done ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                </View>

                <Text
                  selectable={false}
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
              <Text selectable={false} className="text-xs font-bold text-slate-800">
                {name}
              </Text>
            </View>
          ))}
          {task.assignedMemberNames.length > 3 ? (
            <Text selectable={false} className="text-xs font-bold text-slate-500">
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
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const params = useLocalSearchParams<{
    groupId?: string;
    groupName?: string;
    groupKind?: string;
    id?: string;
    userId?: string;
    role?: string;
    userRole?: string;
    accountRole?: string;
    name?: string;
    memberId?: string;
    memberName?: string;
  }>();

  const currentGroupId = String(params.groupId ?? "");
  const currentGroupName = String(params.groupName ?? "");
  const currentGroupKind = String(params.groupKind ?? "");
  const groupCollectionName = currentGroupKind === "coreGroup" ? "coreGroups" : "ministries";

  const currentUserId = String(userId ?? params.userId ?? params.id ?? "");
  const currentMemberId = String(targetMemberId ?? params.memberId ?? params.id ?? "");
  const currentMemberName = String(
    targetMemberName ?? params.memberName ?? params.name ?? memberName ?? "Member"
  );

  const initialRole = normalizeRole(
    userRole ?? params.userRole ?? params.accountRole ?? params.role ?? ""
  );

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
  const [columns, setColumns] = useState<BoardColumn[]>(defaultColumns);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [listName, setListName] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskChecklist, setTaskChecklist] = useState<ChecklistItem[]>([
    { text: "", done: false },
  ]);
  const [showChecklist, setShowChecklist] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>(defaultColumns[0].id);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [deadline, setDeadline] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [columnRects, setColumnRects] = useState<Record<string, ColumnRect | null>>({});
  const [role, setRole] = useState(initialRole);
  const [activeMenuTaskId, setActiveMenuTaskId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);

  const dragStateRef = useRef<DragState | null>(null);
  const columnRectsRef = useRef<Record<string, ColumnRect | null>>({});
  const cardRectsRef = useRef<Record<string, CardRect | null>>({});
  const columnRefs = useRef<Record<string, View | null>>({});

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    columnRectsRef.current = columnRects;
  }, [columnRects]);

  useEffect(() => {
    if (initialRole) setRole(initialRole);
  }, [initialRole]);

  useEffect(() => {
    if (!columns.some((column) => column.id === selectedStatus) && columns[0]) {
      setSelectedStatus(columns[0].id);
    }
  }, [columns, selectedStatus]);

  useEffect(() => {
    const loadRole = async () => {
      if (initialRole || !currentUserId) return;
      try {
        const snap = await getDoc(doc(db, "users", currentUserId));
        const data = snap.data() as any;
        const resolvedRole = normalizeRole(
          data?.role ?? data?.userRole ?? data?.accountRole ?? ""
        );
        setRole(resolvedRole);
      } catch {
        setRole("");
      }
    };
    loadRole();
  }, [currentUserId, initialRole]);

  const effectiveRole = normalizeRole(role || initialRole);
  const canManageTasks = isAdminRole(effectiveRole);

  const closeMenu = useCallback(() => {
    setActiveMenuTaskId(null);
    setMenuAnchor(null);
  }, []);

  const openTaskMenu = useCallback((taskId: string, x: number, y: number) => {
    setActiveMenuTaskId(taskId);
    setMenuAnchor({ taskId, x, y });
  }, []);

  const applyColumns = useCallback(
    async (nextColumns: BoardColumn[]) => {
      setColumns(nextColumns);

      if (!hasGroupContext || !currentGroupId) return;

      try {
        await updateDoc(doc(db, groupCollectionName, currentGroupId), {
          taskColumns: nextColumns,
          updatedAt: Timestamp.now(),
        });
      } catch {
        Alert.alert("Error", "Failed to save lists");
      }
    },
    [currentGroupId, groupCollectionName, hasGroupContext]
  );

  const measureColumns = useCallback(() => {
    columns.forEach((column) => {
      const ref = columnRefs.current[column.id];
      ref?.measureInWindow((x: number, y: number, width: number, height: number) => {
        setColumnRects((prev) => ({
          ...prev,
          [column.id]: { x, y, width, height },
        }));
      });
    });
  }, [columns]);

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
            role: normalizeRole(raw?.role ?? raw?.userRole ?? raw?.accountRole ?? ""),
            ministry: normalizeGroupArray(raw?.ministry),
            coreGroup: normalizeGroupArray(raw?.coreGroup ?? raw?.coreGroups),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const list: TaskItem[] = taskSnap.docs
        .map((d) => {
          const data = d.data() as TaskDoc;
          const normalizedChecklist = normalizeChecklist(data.checklist);
          return {
            id: d.id,
            groupId: String(data.groupId ?? ""),
            groupName: String(data.groupName ?? ""),
            groupKind: String(data.groupKind ?? ""),
            title: String(data.title ?? "").trim(),
            description: String(data.description ?? "").trim(),
            checklist: normalizedChecklist,
            showChecklist:
              typeof data.showChecklist === "boolean"
                ? data.showChecklist
                : normalizedChecklist.length > 0,
            status: (() => {
              const st = String(data.status ?? "").trim().toLowerCase();
              return st || "todo";
            })(),
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
        setColumns(normalizeColumns(groupData?.taskColumns));
      } else {
        setColumns(defaultColumns);
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
    const map: Record<string, TaskItem[]> = {};
    const fallbackStatus = columns[0]?.id ?? "todo";

    columns.forEach((column) => {
      map[column.id] = [];
    });

    tasks.forEach((task) => {
      const status = map[task.status] ? task.status : fallbackStatus;
      if (!map[status]) map[status] = [];
      map[status].push({ ...task, status });
    });

    columns.forEach((column) => {
      map[column.id].sort((a, b) => a.order - b.order);
    });

    return map;
  }, [tasks, columns]);

  const resetTaskForm = () => {
    setEditingTaskId(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskChecklist([{ text: "", done: false }]);
    setShowChecklist(false);
    setSelectedStatus(columns[0]?.id ?? "todo");
    setSelectedMemberIds(hasMemberContext ? [currentMemberId] : []);
    setShowMemberDropdown(false);
    setDeadline(new Date());
    setShowDatePicker(false);
  };

  const resetListForm = () => {
    setEditingColumnId(null);
    setListName("");
  };

  const openNewTaskModal = (status: string = columns[0]?.id ?? "todo") => {
    if (!canManageTasks) return;
    if (!hasGroupContext && !hasMemberContext) return;
    resetTaskForm();
    setSelectedStatus(status);
    setShowChecklist(false);
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
    setShowChecklist(!!task.showChecklist);
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

  const openAddListModal = () => {
    if (!canManageTasks) return;
    resetListForm();
    setShowListModal(true);
  };

  const openEditListModal = (column: BoardColumn) => {
    if (!canManageTasks) return;
    setEditingColumnId(column.id);
    setListName(column.label);
    setShowListModal(true);
  };

  const saveList = async () => {
    if (!canManageTasks) return;

    const label = listName.trim();
    if (!label) {
      return Alert.alert("Error", "Fill list name");
    }

    if (editingColumnId) {
      const nextColumns = columns.map((column) =>
        column.id === editingColumnId ? { ...column, label } : column
      );
      await applyColumns(nextColumns);
    } else {
      const nextColumns = [...columns, { id: createColumnId(), label }];
      await applyColumns(nextColumns);
      setSelectedStatus(nextColumns[nextColumns.length - 1].id);
    }

    setShowListModal(false);
    resetListForm();
  };

  const deleteList = async () => {
    if (!canManageTasks) return;
    if (!editingColumnId) return;
    if (columns.length <= 1) {
      Alert.alert("Error", "You need at least one list");
      return;
    }

    const column = columns.find((item) => item.id === editingColumnId);
    if (!column) return;

    const fallbackColumn = columns.find((item) => item.id !== editingColumnId) ?? columns[0];
    if (!fallbackColumn) return;

    Alert.alert(
      "Delete list",
      `Remove "${column.label}"? Tasks in this list will move to "${fallbackColumn.label}".`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const batch = writeBatch(db);

              const tasksToMove = tasks.filter((task) => task.status === editingColumnId);
              tasksToMove.forEach((task, index) => {
                batch.update(doc(db, "tasks", task.id), {
                  status: fallbackColumn.id,
                  order: index,
                  updatedAt: Timestamp.now(),
                });
              });

              const nextColumns = columns.filter((item) => item.id !== editingColumnId);
              if (hasGroupContext && currentGroupId) {
                batch.update(doc(db, groupCollectionName, currentGroupId), {
                  taskColumns: nextColumns,
                  updatedAt: Timestamp.now(),
                });
              }

              await batch.commit();

              setShowListModal(false);
              resetListForm();
              await loadTasks();
            } catch {
              Alert.alert("Error", "Failed to delete list");
            }
          },
        },
      ]
    );
  };

  const moveColumn = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= columns.length) return;

    const nextColumns = [...columns];
    [nextColumns[index], nextColumns[nextIndex]] = [nextColumns[nextIndex], nextColumns[index]];
    await applyColumns(nextColumns);
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
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
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

    const activeStatus = columns.some((column) => column.id === selectedStatus)
      ? selectedStatus
      : columns[0]?.id ?? "todo";

    setSaving(true);
    try {
      const payload = {
        groupId: hasGroupContext ? currentGroupId : "",
        groupName: hasGroupContext ? currentGroupName : "",
        groupKind: hasGroupContext ? currentGroupKind : "",
        title,
        description,
        checklist: cleanChecklist,
        showChecklist,
        status: activeStatus,
        deadline: deadline.toISOString().slice(0, 10),
        deadlineAt: Timestamp.fromDate(deadline),
        assignedMemberIds: activeMemberIds,
        assignedMemberNames: memberNames,
        updatedAt: Timestamp.now(),
      };

      if (editingTaskId) {
        await updateDoc(doc(db, "tasks", editingTaskId), payload);
      } else {
        const nextOrder = groupedTasks[activeStatus]?.length ?? 0;

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
    try {
      await deleteDoc(doc(db, "tasks", taskId));
      await loadTasks();
    } catch {
      Alert.alert("Error", "Failed to delete task");
    }
  };

  const startDrag = useCallback(
    (task: TaskItem, x: number, y: number, width: number, height: number) => {
      measureColumns();
      closeMenu();
      setDragState({
        task,
        x: x - width / 2,
        y: y - height / 2,
        width,
        height,
      });
    },
    [closeMenu, measureColumns]
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

  const reorderList = (list: TaskItem[], movingTask: TaskItem, insertIndex: number) => {
    const next = list.filter((item) => item.id !== movingTask.id);
    const safeIndex = Math.max(0, Math.min(insertIndex, next.length));
    next.splice(safeIndex, 0, movingTask);
    return next;
  };

  const endDrag = useCallback(
    async (x: number, y: number) => {
      const current = dragStateRef.current;
      if (!current) return;

      const rects = columnRectsRef.current;
      const targetStatus = (Object.keys(rects) as string[]).find((status) => {
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

      if (!targetStatus) {
        return;
      }

      const sourceStatus = current.task.status;
      const sourceTasks = groupedTasks[sourceStatus] ?? [];
      const targetTasks = groupedTasks[targetStatus] ?? [];
      const targetWithoutMoving =
        targetStatus === sourceStatus
          ? targetTasks.filter((task) => task.id !== current.task.id)
          : targetTasks;

      let insertIndex = targetWithoutMoving.length;
      for (let i = 0; i < targetWithoutMoving.length; i++) {
        const rect = cardRectsRef.current[targetWithoutMoving[i].id];
        if (!rect) continue;
        const midpoint = rect.y + rect.height / 2;
        if (y < midpoint) {
          insertIndex = i;
          break;
        }
      }

      const nextTargetOrder = reorderList(targetWithoutMoving, current.task, insertIndex);

      const sameOrder =
        sourceStatus === targetStatus &&
        sourceTasks.map((task) => task.id).join("|") ===
          nextTargetOrder.map((task) => task.id).join("|");

      if (sameOrder) {
        return;
      }

      try {
        const batch = writeBatch(db);
        const now = Timestamp.now();

        if (targetStatus === sourceStatus) {
          nextTargetOrder.forEach((task, index) => {
            batch.update(doc(db, "tasks", task.id), {
              status: targetStatus,
              order: index,
              updatedAt: now,
            });
          });
        } else {
          const nextSourceOrder = sourceTasks.filter((task) => task.id !== current.task.id);

          nextSourceOrder.forEach((task, index) => {
            batch.update(doc(db, "tasks", task.id), {
              status: sourceStatus,
              order: index,
              updatedAt: now,
            });
          });

          nextTargetOrder.forEach((task, index) => {
            batch.update(doc(db, "tasks", task.id), {
              status: targetStatus,
              order: index,
              updatedAt: now,
            });
          });
        }

        await batch.commit();
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

  const renderColumn = (column: BoardColumn) => {
    const data = groupedTasks[column.id] ?? [];
    const isDropTarget = (() => {
      if (!dragState) return false;
      const rect = columnRects[column.id];
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
        key={column.id}
        ref={(node) => {
          columnRefs.current[column.id] = node;
        }}
        collapsable={false}
        onLayout={measureColumns}
        className={`w-[300px] min-h-[500px] rounded-[24px] border p-3 ${
          isDropTarget ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-slate-100/80"
        }`}
        style={{
          overflow: "visible",
        }}
      >
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Text selectable={false} className="text-[18px] font-black text-slate-900">
              {column.label}
            </Text>
            <View className="rounded-full bg-slate-900 px-2.5 py-1">
              <Text selectable={false} className="text-[11px] font-bold text-white">
                {data.length}
              </Text>
            </View>
          </View>

          {canManageTasks ? (
            <Pressable
              onPress={() => openEditListModal(column)}
              className="h-9 w-9 items-center justify-center rounded-full bg-white"
              style={({ pressed }) =>
                pressed
                  ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                  : {
                      shadowColor: "#000",
                      shadowOpacity: 0.08,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 1,
                    }
              }
            >
              <Ionicons name="pencil-outline" size={18} color="#0f172a" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          onScrollBeginDrag={() => closeMenu()}
          contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
        >
          {data.length === 0 ? (
            <View className="items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-8">
              <View className="mb-2 h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                <Ionicons name="file-tray-outline" size={20} color="#94a3b8" />
              </View>
              <Text selectable={false} className="text-[13px] font-bold text-slate-500">
                No tasks yet
              </Text>
            </View>
          ) : null}

          {data.map((item) => (
            <TaskCard
              key={item.id}
              task={item}
              onEdit={openEditTaskModal}
              onDelete={(taskId) => {
                closeMenu();
                setDeleteConfirmTaskId(taskId);
              }}
              onToggleChecklist={toggleChecklist}
              onStartDrag={startDrag}
              canManageTask={canManageTasks}
              showGroupMeta={!hasGroupContext}
              onMeasure={(taskId, rect) => {
                cardRectsRef.current[taskId] = rect;
              }}
              onOpenMenu={openTaskMenu}
              menuOpenTaskId={activeMenuTaskId}
            />
          ))}

          {canManageTasks ? (
            <Pressable
              onPress={() => openNewTaskModal(column.id)}
              className="flex-row items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3"
              style={({ pressed }) =>
                pressed ? { opacity: 0.9, transform: [{ scale: 0.99 }] } : undefined
              }
            >
              <Ionicons name="add" size={18} color="#0f172a" />
              <Text selectable={false} className="ml-2 text-[13px] font-extrabold text-slate-900">
                Add a card
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    );
  };

  const renderAddColumnCard = () => {
    if (!canManageTasks) return null;

    return (
      <Pressable
        onPress={openAddListModal}
        className="w-[300px] min-h-[500px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-100/80 p-3"
        style={({ pressed }) =>
          pressed
            ? { opacity: 0.9, transform: [{ scale: 0.99 }] }
            : {
                shadowColor: "#000",
                shadowOpacity: 0.03,
                shadowRadius: 2,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              }
        }
      >
        <View className="items-center justify-center rounded-[24px] border border-slate-200 bg-white px-6 py-8">
          <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-slate-900">
            <Ionicons name="add" size={30} color="white" />
          </View>
          <Text selectable={false} className="text-[16px] font-black text-slate-900">
            Add List
          </Text>
          <Text selectable={false} className="mt-1 text-center text-[12px] font-semibold text-slate-500">
            Create a new board column
          </Text>
        </View>
      </Pressable>
    );
  };

  const menuWidth = 176;
  const menuLeft = menuAnchor
    ? Math.max(12, Math.min(menuAnchor.x - menuWidth + 18, screenWidth - menuWidth - 12))
    : 0;
  const menuTop = menuAnchor ? Math.max(12, menuAnchor.y + 10) : 0;

  const selectedMemberNames = selectedMemberIds
    .map((id) => users.find((u) => u.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  const greetingName = currentMemberName || "Member";

  const taskToDelete = deleteConfirmTaskId
    ? tasks.find((task) => task.id === deleteConfirmTaskId)
    : null;

  const confirmDeleteTask = async () => {
    if (!deleteConfirmTaskId) return;
    const deletingId = deleteConfirmTaskId;
    setDeleteConfirmTaskId(null);
    await deleteTask(deletingId);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <Text selectable={false} className="text-base font-semibold text-slate-900">
          Loading...
        </Text>
      </View>
    );
  }

  if (hasGroupContext && (!currentGroupId || !currentGroupName)) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <Text selectable={false} className="text-base font-semibold text-slate-900">
          Missing group
        </Text>
      </View>
    );
  }

  if (hasMemberContext && !currentMemberId) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <Text selectable={false} className="text-base font-semibold text-slate-900">
          Missing member
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 pt-2" {...boardResponder.panHandlers}>
      <View className="px-4 pb-3">
        <View className="rounded-[24px] bg-white px-4 py-4 shadow-sm">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              {hasGroupContext ? (
                <>
                  <Text selectable={false} className="text-[28px] font-black leading-[34px] text-slate-900">
                    {groupInfo.name || currentGroupName}
                  </Text>
                  <Text selectable={false} className="mt-1 text-sm font-semibold leading-5 text-slate-500">
                    {groupInfo.description?.trim()
                      ? groupInfo.description
                      : "No description provided"}
                  </Text>
                </>
              ) : (
                <>
                  <Text selectable={false} className="text-[28px] font-black leading-[34px] text-slate-900">
                    Tasks for {greetingName}
                  </Text>
                  <Text selectable={false} className="mt-1 text-sm font-semibold leading-5 text-slate-500">
                    Admin tasks assigned to this member
                  </Text>
                </>
              )}
            </View>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/admin/members",
                  params: {
                    groupId: currentGroupId,
                    groupKind: currentGroupKind,
                    groupName: currentGroupName,
                  },
                })
              }
              className="h-10 flex-row items-center rounded-full bg-slate-100 px-3"
              style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
            >
              <Ionicons name="people" size={20} color="#0f172a" />
              <Text selectable={false} className="ml-2 text-[12px] font-bold text-slate-900">
                View Board Member
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        onScrollBeginDrag={() => closeMenu()}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, gap: 14 }}
      >
        {columns.map((column) => renderColumn(column))}
        {renderAddColumnCard()}
      </ScrollView>

      {canManageTasks && (hasGroupContext || hasMemberContext) ? (
        <TaskModal
          visible={showTaskModal}
          onClose={() => {
            setShowTaskModal(false);
            resetTaskForm();
          }}
          onSave={saveTask}
          editingTaskId={editingTaskId}
          taskTitle={taskTitle}
          onTaskTitleChange={setTaskTitle}
          taskDescription={taskDescription}
          onTaskDescriptionChange={setTaskDescription}
          deadline={deadline}
          onDeadlineChange={setDeadline}
          showDatePicker={showDatePicker}
          onShowDatePickerChange={setShowDatePicker}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          columns={columns}
          showChecklist={showChecklist}
          onChecklistToggle={setShowChecklist}
          taskChecklist={taskChecklist}
          onChecklistItemChange={updateChecklistItem}
          onChecklistItemRemove={removeChecklistItem}
          onChecklistItemAdd={() =>
            setTaskChecklist((prev) => [...prev, { text: "", done: false }])
          }
          selectedMemberNames={selectedMemberNames}
          showMemberDropdown={showMemberDropdown}
          onMemberDropdownChange={setShowMemberDropdown}
          eligibleUsers={eligibleUsers}
          selectedMemberIds={selectedMemberIds}
          onMemberToggle={toggleMember}
          hasGroupContext={hasGroupContext}
          hasMemberContext={hasMemberContext}
          greetingName={greetingName}
          saving={saving}
          formatDateDisplay={formatDateDisplay}
        />
      ) : null}

      {canManageTasks && (hasGroupContext || hasMemberContext) ? (
        <ListModal
          visible={showListModal}
          onClose={() => {
            setShowListModal(false);
            resetListForm();
          }}
          onSave={saveList}
          editingColumnId={editingColumnId}
          listName={listName}
          onListNameChange={setListName}
          columns={columns}
          onMoveColumn={moveColumn}
          onDeleteList={deleteList}
        />
      ) : null}

      <TaskActionMenuModal
        visible={!!menuAnchor}
        x={menuLeft}
        y={menuTop}
        onClose={closeMenu}
        onEdit={() => {
          if (!menuAnchor) return;
          const task = tasks.find((t) => t.id === menuAnchor.taskId);
          if (task) openEditTaskModal(task);
        }}
        onDelete={() => {
          if (!menuAnchor) return;
          setDeleteConfirmTaskId(menuAnchor.taskId);
        }}
      />

      <DeleteConfirmModal
        visible={!!deleteConfirmTaskId}
        taskTitle={taskToDelete?.title ?? ""}
        onCancel={() => setDeleteConfirmTaskId(null)}
        onConfirm={confirmDeleteTask}
      />

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
            <Text selectable={false} className="text-base font-extrabold text-slate-900">
              {dragState.task.title}
            </Text>
            <Text selectable={false} className="text-[13px] leading-[18px] text-slate-600">
              {dragState.task.description || "No description provided"}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}