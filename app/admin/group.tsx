import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { TextInput } from "react-native-paper";
import { db } from "../../lib/firebaseConfig";

const DEFAULT_MINISTRY = {
  id: "seed-care-group",
  kind: "ministry",
  name: "Care Group",
  description: "this is already fill up for unregister",
  memberId: "",
  memberName: "",
  createdAt: null,
  isActive: false,
  subgroups: [],
  isSeed: true,
  colorTag: "red",
  ministryType: "members",
};

const MINISTRY_TYPE_OPTIONS = [
  { key: "members", label: "Members" },
  { key: "groups", label: "Groups" },
  { key: "all", label: "All" },
];

const STATUS_OPTIONS = [
  { key: true, label: "Active" },
  { key: false, label: "Inactive" },
];

const COLOR_TAG_OPTIONS = [
  { key: "gray", label: "Gray", bg: "#F3F4F6", border: "#E5E7EB", text: "#111827", icon: "#6B7280", hex: "#6B7280" },
  { key: "blue", label: "Blue", bg: "#EFF6FF", border: "#BFDBFE", text: "#1E3A8A", icon: "#2563EB", hex: "#2563EB" },
  { key: "green", label: "Green", bg: "#ECFDF5", border: "#A7F3D0", text: "#14532D", icon: "#10B981", hex: "#10B981" },
  { key: "amber", label: "Amber", bg: "#FFFBEB", border: "#FDE68A", text: "#78350F", icon: "#F59E0B", hex: "#F59E0B" },
  { key: "red", label: "Red", bg: "#FEF2F2", border: "#FECACA", text: "#7F1D1D", icon: "#EF4444", hex: "#EF4444" },
  { key: "purple", label: "Purple", bg: "#F5F3FF", border: "#DDD6FE", text: "#4C1D95", icon: "#8B5CF6", hex: "#8B5CF6" },
  { key: "pink", label: "Pink", bg: "#FDF2F8", border: "#FBCFE8", text: "#831843", icon: "#EC4899", hex: "#EC4899" },
  { key: "teal", label: "Teal", bg: "#F0FDFA", border: "#99F6E4", text: "#134E4A", icon: "#14B8A6", hex: "#14B8A6" },
];

const normalizeIds = (ids) => Array.from(new Set(ids.filter(Boolean)));

const getErrorMessage = (error) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

const parseBooleanLike = (value, fallback = true) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "active", "enabled"].includes(normalized)) return true;
    if (["false", "0", "no", "inactive", "disabled"].includes(normalized)) return false;
  }

  return fallback;
};

const normalizeRole = (value) => String(value ?? "").trim().toLowerCase();

const getDisplayName = (data) =>
  String(data?.memberName || data?.name || data?.fullName || data?.displayName || "").trim();

const normalizeColorTag = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  // If it's a hex code, find the matching key
  const foundByHex = COLOR_TAG_OPTIONS.find((item) => item.hex.toLowerCase() === normalized);
  if (foundByHex) return foundByHex.key;
  // If it's a key, return it if found
  const foundByKey = COLOR_TAG_OPTIONS.find((item) => item.key === normalized);
  return foundByKey ? foundByKey.key : "gray";
};

const getColorTagStyle = (colorTag) => {
  const found = COLOR_TAG_OPTIONS.find((item) => item.key === colorTag) || COLOR_TAG_OPTIONS[0];
  return found;
};

export default function Group({ userId, userRole, memberName, isLandscape }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [containerWidth, setContainerWidth] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [ministryType, setMinistryType] = useState("members");
  const [isActive, setIsActive] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedMemberName, setSelectedMemberName] = useState("");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [editingMinistryId, setEditingMinistryId] = useState(null);
  const [selectedColorTag, setSelectedColorTag] = useState("gray");

  const [activeMenuId, setActiveMenuId] = useState(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const columns = isLandscape ? 4 : 2;
  const pagePadding = 20;
  const gap = 12;

  const itemSize = useMemo(() => {
    if (!containerWidth) return 0;
    const availableWidth = containerWidth - pagePadding * 2 - gap * (columns - 1);
    return Math.floor(availableWidth / columns);
  }, [containerWidth, columns]);

  const iconSize = useMemo(() => {
    if (!itemSize) return 36;
    return Math.max(28, Math.min(36, Math.floor(itemSize * 0.28)));
  }, [itemSize]);

  const iconBoxSize = useMemo(() => {
    if (!itemSize) return 72;
    return Math.max(52, Math.min(72, Math.floor(itemSize * 0.44)));
  }, [itemSize]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ministrySnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "ministries")),
        getDocs(collection(db, "users")),
      ]);

      const careGroupName = DEFAULT_MINISTRY.name.trim().toLowerCase();
      const careGroupDoc = ministrySnap.docs.find(
        (d) => String(d.data()?.name ?? "").trim().toLowerCase() === careGroupName
      );

      if (careGroupDoc) {
        const careData = careGroupDoc.data();
        const currentColorTag = normalizeColorTag(careData?.colorTag ?? careData?.tagColor ?? "gray");
        const currentActive = parseBooleanLike(
          careData?.isActive ?? careData?.active ?? careData?.status ?? careData?.state,
          false
        );

        const updates = {};
        const redHex = "#EF4444";
        if (currentColorTag !== "red") updates.colorTag = redHex;
        if (currentActive !== false) updates.isActive = false;
        if (String(careData?.description ?? "").trim() !== DEFAULT_MINISTRY.description) {
          updates.description = DEFAULT_MINISTRY.description;
        }
        if (String(careData?.memberId ?? "").trim() !== "") updates.memberId = "";
        if (String(careData?.memberName ?? "").trim() !== "") updates.memberName = "";
        if (String(careData?.ministryType ?? "members").trim().toLowerCase() !== "members") {
          updates.ministryType = "members";
        }
        if (!Array.isArray(careData?.subgroups) || careData.subgroups.length !== 0) {
          updates.subgroups = [];
        }

        if (Object.keys(updates).length > 0) {
          await updateDoc(doc(db, "ministries", careGroupDoc.id), updates);
        }
      } else {
        await addDoc(collection(db, "ministries"), {
          kind: "ministry",
          name: DEFAULT_MINISTRY.name,
          description: DEFAULT_MINISTRY.description,
          ministryType: DEFAULT_MINISTRY.ministryType,
          memberId: DEFAULT_MINISTRY.memberId,
          memberName: DEFAULT_MINISTRY.memberName,
          createdAt: new Date().toISOString(),
          isActive: DEFAULT_MINISTRY.isActive,
          subgroups: [],
          isSeed: true,
          colorTag: "#EF4444",
        });
      }

      const ministryData = ministrySnap.docs
        .map((d) => {
          const data = d.data();
          const rawActive = data?.isActive ?? data?.active ?? data?.status ?? data?.state;
          const memberAssignedName = String(data?.memberName ?? data?.leaderName ?? "").trim();
          const memberAssignedId = String(data?.memberId ?? data?.leaderId ?? "").trim();
          const colorTag = normalizeColorTag(data?.colorTag ?? data?.tagColor ?? "gray");
          const normalizedName = String(data?.name ?? "").trim();
          const isCareGroup = normalizedName.toLowerCase() === careGroupName;

          const subgroups = Array.isArray(data?.subgroups)
            ? data.subgroups.map((subgroup, index) => ({
                id: String(subgroup?.id ?? `${d.id}-${index}`),
                name: String(subgroup?.name ?? ""),
                memberIds: normalizeIds(
                  Array.isArray(subgroup?.memberIds) ? subgroup.memberIds.map((x) => String(x)) : []
                ),
              }))
            : [];

          return {
            id: d.id,
            kind: "ministry",
            name: normalizedName,
            description: String(data?.description ?? "").trim(),
            ministryType: String(data?.ministryType ?? "members").trim().toLowerCase(),
            memberId: memberAssignedId,
            memberName: memberAssignedName,
            createdAt: data?.createdAt,
            isActive: parseBooleanLike(rawActive, true),
            subgroups,
            isSeed: isCareGroup,
            colorTag: isCareGroup ? "red" : colorTag,
          };
        })
        .filter((x) => x.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      const hasDefaultMinistry = ministryData.some(
        (item) => item.name.trim().toLowerCase() === careGroupName
      );

      const finalMinistries = hasDefaultMinistry
        ? ministryData.map((item) =>
            item.name.trim().toLowerCase() === careGroupName
              ? { ...item, isActive: false, colorTag: "red", isSeed: true }
              : item
          )
        : [DEFAULT_MINISTRY, ...ministryData].sort((a, b) => a.name.localeCompare(b.name));

      const memberData = usersSnap.docs
        .map((d) => {
          const data = d.data();
          const role = normalizeRole(data?.role ?? data?.userRole ?? data?.accountRole ?? "");
          return {
            id: d.id,
            name: getDisplayName(data),
            role,
            isAdmin: role.includes("admin"),
          };
        })
        .filter((x) => x.name && !x.isAdmin)
        .sort((a, b) => a.name.localeCompare(b.name));

      setGroups(finalMinistries);
      setMembers(memberData);
    } catch (error) {
      Alert.alert("Error", `Failed to load ministries\n${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMembersOnly = useCallback(async () => {
    setMembersLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const memberData = usersSnap.docs
        .map((d) => {
          const data = d.data();
          const role = normalizeRole(data?.role ?? data?.userRole ?? data?.accountRole ?? "");
          return {
            id: d.id,
            name: getDisplayName(data),
            role,
            isAdmin: role.includes("admin"),
          };
        })
        .filter((x) => x.name && !x.isAdmin)
        .sort((a, b) => a.name.localeCompare(b.name));

      setMembers(memberData);
    } catch (error) {
      Alert.alert("Error", `Failed to load members\n${getErrorMessage(error)}`);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;

    return groups.filter((group) => {
      const nameMatch = group.name.toLowerCase().includes(q);
      const descriptionMatch = group.description.toLowerCase().includes(q);
      const memberMatch = group.memberName.toLowerCase().includes(q);
      return nameMatch || descriptionMatch || memberMatch;
    });
  }, [groups, searchQuery]);

  const filteredMembers = useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase();
    if (!q) return members;

    return members.filter((member) => member.name.toLowerCase().includes(q));
  }, [members, memberSearchQuery]);

  const openGroup = (group) => {
    const baseParams = {
      groupId: group.id,
      groupName: group.name,
      groupKind: group.kind,
      id: String(userId ?? ""),
      userId: String(userId ?? ""),
      userRole: String(userRole ?? ""),
      role: String(userRole ?? ""),
      memberName: String(memberName ?? ""),
    };

    router.push({
      pathname: group.isActive ? "/task-board" : "/admin/members",
      params: baseParams,
    });
  };

  const onContainerLayout = (event) => {
    const width = event.nativeEvent.layout.width;
    setContainerWidth(width);
  };

  const resetModal = () => {
    setNewName("");
    setNewDescription("");
    setMinistryType("members");
    setIsActive(true);
    setSelectedMemberId("");
    setSelectedMemberName("");
    setMemberSearchQuery("");
    setEditingMinistryId(null);
    setSelectedColorTag("gray");
  };

  const closeModal = () => {
    setModalVisible(false);
    setMemberPickerVisible(false);
    resetModal();
  };

  const openAddModal = () => {
    resetModal();
    setModalVisible(true);
    loadMembersOnly();
  };

  const openEditModal = (ministry) => {
    if (ministry?.isSeed) return;

    setEditingMinistryId(ministry.id);
    setNewName(ministry?.name ?? "");
    setNewDescription(ministry?.description ?? "");
    setMinistryType(ministry?.ministryType ?? "members");
    setIsActive(Boolean(ministry?.isActive));
    setSelectedMemberId(ministry?.memberId ?? "");
    setSelectedMemberName(ministry?.memberName ?? "");
    setSelectedColorTag(normalizeColorTag(ministry?.colorTag ?? "gray"));
    setMemberSearchQuery("");
    setModalVisible(true);
    loadMembersOnly();
  };

  const handleSaveMinistry = async () => {
    const name = newName.trim();
    const description = newDescription.trim();

    if (!name) {
      Alert.alert("Missing name", "Please enter a ministry name.");
      return;
    }

    if (!selectedMemberId || !selectedMemberName) {
      Alert.alert("Missing member", "Please select one head ministry.");
      return;
    }

    try {
      setSaving(true);

      const colorOption = COLOR_TAG_OPTIONS.find((c) => c.key === selectedColorTag);
      const payload = {
        name,
        description,
        ministryType,
        isActive,
        memberId: selectedMemberId,
        memberName: selectedMemberName,
        subgroups: [],
        colorTag: colorOption?.hex ?? "#6B7280",
      };

      if (editingMinistryId) {
        await updateDoc(doc(db, "ministries", editingMinistryId), payload);
      } else {
        await addDoc(collection(db, "ministries"), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
      }

      closeModal();
      await loadData();
    } catch (error) {
      Alert.alert(
        "Error",
        `Failed to ${editingMinistryId ? "update" : "add"} ministry\n${getErrorMessage(error)}`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleOpenMenu = (groupId) => {
    setActiveMenuId((current) => (current === groupId ? null : groupId));
  };

  const handleCloseMenu = () => {
    setActiveMenuId(null);
  };

  const handlePressEditFromMenu = (group) => {
    handleCloseMenu();
    openEditModal(group);
  };

  const handlePressDeleteFromMenu = (group) => {
    handleCloseMenu();
    setDeleteTarget(group);
    setDeleteConfirmVisible(true);
  };

  const handleDeleteGroup = async () => {
    if (!deleteTarget?.id) return;

    try {
      setSaving(true);
      await deleteDoc(doc(db, "ministries", deleteTarget.id));
      setDeleteConfirmVisible(false);
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      Alert.alert("Error", `Failed to delete ministry\n${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item, index }) => {
    const isLastInRow = (index + 1) % columns === 0;
    const isSeed = Boolean(item.isSeed);
    const isMenuOpen = activeMenuId === item.id;
    const colorStyle = getColorTagStyle(item.colorTag);

    return (
      <View
        className="relative overflow-visible"
        style={{
          width: itemSize,
          height: itemSize,
          marginRight: isLastInRow ? 0 : gap,
          marginBottom: gap,
          zIndex: isMenuOpen ? 50 : 1,
        }}
      >
        <Pressable
          onPress={() => {
            if (isMenuOpen) {
              handleCloseMenu();
              return;
            }
            openGroup(item);
          }}
          className="flex-1 overflow-hidden rounded-[18px]"
          style={{
            backgroundColor: colorStyle.bg,
            borderWidth: 1,
            borderColor: colorStyle.border,
            elevation: 1,
            shadowColor: "#000",
            shadowOpacity: 0.05,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          {!isSeed ? (
            <Pressable
              onPress={(e) => {
                e?.stopPropagation?.();
                handleOpenMenu(item.id);
              }}
              className="absolute right-2 top-2 z-20 h-8 w-8 items-center justify-center rounded-full bg-white/90"
              style={{
                elevation: 4,
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
              }}
            >
              <Ionicons name="ellipsis-vertical" size={16} color="#111827" />
            </Pressable>
          ) : null}

          {isMenuOpen && !isSeed ? (
            <>
              <Pressable
                onPress={(e) => {
                  e?.stopPropagation?.();
                  handleCloseMenu();
                }}
                className="absolute inset-0 z-30"
              />
              <View
                className="absolute right-2 top-[-2px] z-40 w-[140px] rounded-[16px] border border-gray-200 bg-white p-1"
                style={{
                  elevation: 8,
                  shadowColor: "#000",
                  shadowOpacity: 0.16,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                }}
              >
                <Pressable
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    handlePressEditFromMenu(item);
                  }}
                  className="flex-row items-center rounded-[12px] px-3 py-2.5"
                >
                  <Ionicons name="pencil-outline" size={18} color="#111827" />
                  <Text className="ml-2 text-[14px] font-semibold text-gray-900">Edit</Text>
                </Pressable>

                <Pressable
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    handlePressDeleteFromMenu(item);
                  }}
                  className="flex-row items-center rounded-[12px] px-3 py-2.5"
                >
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  <Text className="ml-2 text-[14px] font-semibold text-red-600">Delete</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          <View className="flex-1 items-center justify-center rounded-[14px] p-3">
            <View
              className="mb-3 items-center justify-center"
              style={{
                width: iconBoxSize,
                height: iconBoxSize,
                borderRadius: Math.floor(iconBoxSize * 0.22),
                backgroundColor: colorStyle.icon,
              }}
            >
              <Ionicons name={isSeed ? "heart" : "business"} size={iconSize} color="white" />
            </View>
            <Text
              numberOfLines={2}
              className="px-2 text-center text-[16px] font-extrabold leading-5 text-gray-900"
            >
              {item.name}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-[#F7F8FA]" onLayout={onContainerLayout}>
      {loading ? (
        <View className="flex-1 items-center justify-center py-10">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
          key={`${columns}-${itemSize}`}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={columns}
          ListHeaderComponent={
            <View className="mb-4">
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <TextInput
                    mode="outlined"
                    label="Search ministry"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    left={<TextInput.Icon icon="magnify" />}
                    right={
                      searchQuery ? (
                        <TextInput.Icon icon="close-circle" onPress={() => setSearchQuery("")} />
                      ) : null
                    }
                    theme={{
                      roundness: 16,
                    }}
                    outlineStyle={{
                      borderRadius: 16,
                    }}
                    contentStyle={{
                      paddingHorizontal: 4,
                    }}
                    style={{
                      backgroundColor: "white",
                    }}
                  />
                </View>

                <Pressable
                  onPress={() => {
                    handleCloseMenu();
                    openAddModal();
                  }}
                  className="h-12 w-12 items-center justify-center rounded-2xl bg-gray-900"
                  style={{
                    elevation: 2,
                    shadowColor: "#000",
                    shadowOpacity: 0.12,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 },
                  }}
                >
                  <Ionicons name="add" size={24} color="white" />
                </Pressable>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="mt-8 items-center justify-center rounded-[18px] border border-dashed border-gray-300 bg-white p-6">
              <Ionicons name="folder-open-outline" size={34} color="#9CA3AF" />
              <Text className="mt-3 text-[15px] font-semibold text-gray-500">
                No ministries found
              </Text>
            </View>
          }
          contentContainerStyle={{
            paddingHorizontal: pagePadding,
            paddingTop: pagePadding,
            paddingBottom: 100,
          }}
          columnWrapperStyle={{
            justifyContent: "flex-start",
          }}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={handleCloseMenu}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable onPress={closeModal} className="flex-1 justify-center bg-black/45 p-5">
          <Pressable
            onPress={() => {}}
            className="w-full max-w-[420px] self-center rounded-[20px] bg-white p-4"
            style={{
              elevation: 6,
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[18px] font-extrabold text-gray-900">
                {editingMinistryId ? "Edit Ministry" : "Add Ministry"}
              </Text>
              <Pressable
                onPress={closeModal}
                className="h-9 w-9 items-center justify-center rounded-xl bg-gray-100"
              >
                <Ionicons name="close" size={22} color="#111827" />
              </Pressable>
            </View>

            <View className="gap-3">
              <TextInput
                mode="outlined"
                label="Ministry name"
                value={newName}
                onChangeText={setNewName}
                theme={{ roundness: 14 }}
                outlineStyle={{ borderRadius: 14 }}
                style={{ backgroundColor: "white" }}
              />

              <TextInput
                mode="outlined"
                label="Description"
                value={newDescription}
                onChangeText={setNewDescription}
                theme={{ roundness: 14 }}
                outlineStyle={{ borderRadius: 14 }}
                style={{ backgroundColor: "white" }}
                multiline
              />

              <View className="rounded-[14px] border border-gray-200 bg-white p-3">
                <Text className="mb-2 text-[12px] font-semibold text-gray-500">Tag color</Text>
                <View className="flex-row flex-wrap gap-2">
                  {COLOR_TAG_OPTIONS.map((option) => {
                    const active = selectedColorTag === option.key;

                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => setSelectedColorTag(option.key)}
                        className={`min-w-[72px] flex-row items-center justify-center rounded-full px-3 py-2 ${
                          active ? "border-2" : "border"
                        }`}
                        style={{
                          backgroundColor: option.bg,
                          borderColor: active ? option.icon : option.border,
                        }}
                      >
                        <View
                          className="mr-2 h-3 w-3 rounded-full"
                          style={{ backgroundColor: option.icon }}
                        />
                        <Text className="text-[13px] font-bold" style={{ color: option.text }}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="rounded-[14px] border border-gray-200 bg-white p-3">
                <Text className="mb-2 text-[12px] font-semibold text-gray-500">Ministry type</Text>
                <View className="flex-row rounded-[14px] bg-gray-100 p-1">
                  {MINISTRY_TYPE_OPTIONS.map((option) => {
                    const active = ministryType === option.key;

                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => setMinistryType(option.key)}
                        className={`flex-1 items-center justify-center rounded-[12px] py-2 ${
                          active ? "bg-white" : "bg-transparent"
                        }`}
                      >
                        <Text
                          className={`text-[13px] font-bold ${
                            active ? "text-gray-900" : "text-gray-500"
                          }`}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="rounded-[14px] border border-gray-200 bg-white p-3">
                <Text className="mb-2 text-[12px] font-semibold text-gray-500">Status</Text>
                <View className="flex-row rounded-[14px] bg-gray-100 p-1">
                  {STATUS_OPTIONS.map((option) => {
                    const active = isActive === option.key;

                    return (
                      <Pressable
                        key={String(option.key)}
                        onPress={() => setIsActive(option.key)}
                        className={`flex-1 items-center justify-center rounded-[12px] py-2 ${
                          active ? "bg-white" : "bg-transparent"
                        }`}
                      >
                        <Text
                          className={`text-[13px] font-bold ${
                            active ? "text-gray-900" : "text-gray-500"
                          }`}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable
                onPress={() => {
                  setMemberPickerVisible(true);
                  loadMembersOnly();
                }}
                className="min-h-[58px] flex-row items-center justify-between rounded-[14px] border border-gray-300 bg-white px-4 py-3"
              >
                <View className="flex-1 pr-3">
                  <Text className="mb-1 text-[12px] font-semibold text-gray-500">
                    Select head ministry
                  </Text>
                  <Text
                    numberOfLines={1}
                    className={`text-[15px] font-semibold ${
                      selectedMemberName ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {selectedMemberName || "Tap to choose one member"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </Pressable>

              <View className="mt-2 flex-row gap-2">
                <Pressable
                  onPress={closeModal}
                  disabled={saving}
                  className="flex-1 h-12 items-center justify-center rounded-[14px] bg-gray-200"
                >
                  <Text className="text-[15px] font-bold text-gray-900">Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveMinistry}
                  disabled={saving}
                  className="flex-1 h-12 items-center justify-center rounded-[14px] bg-gray-900"
                >
                  {saving ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-[15px] font-bold text-white">
                      {editingMinistryId ? "Update" : "Save"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={memberPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMemberPickerVisible(false)}
      >
        <Pressable
          onPress={() => setMemberPickerVisible(false)}
          className="flex-1 justify-center bg-black/45 p-5"
        >
          <Pressable
            onPress={() => {}}
            className="w-full max-w-[420px] self-center max-h-[78%] rounded-[20px] bg-white p-4"
            style={{
              elevation: 6,
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[18px] font-extrabold text-gray-900">Select one member</Text>
              <Pressable
                onPress={() => setMemberPickerVisible(false)}
                className="h-9 w-9 items-center justify-center rounded-xl bg-gray-100"
              >
                <Ionicons name="close" size={22} color="#111827" />
              </Pressable>
            </View>

            <TextInput
              mode="outlined"
              label="Search member"
              value={memberSearchQuery}
              onChangeText={setMemberSearchQuery}
              left={<TextInput.Icon icon="magnify" />}
              right={
                memberSearchQuery ? (
                  <TextInput.Icon icon="close-circle" onPress={() => setMemberSearchQuery("")} />
                ) : null
              }
              theme={{ roundness: 14 }}
              outlineStyle={{ borderRadius: 14 }}
              style={{ backgroundColor: "white" }}
            />

            <View className="mt-3 flex-1 min-h-[180px]">
              {membersLoading ? (
                <View className="flex-1 items-center justify-center py-6">
                  <ActivityIndicator />
                </View>
              ) : (
                <FlatList
                  data={filteredMembers}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const isSelected = item.id === selectedMemberId;

                    return (
                      <Pressable
                        onPress={() => {
                          setSelectedMemberId(item.id);
                          setSelectedMemberName(item.name);
                          setMemberPickerVisible(false);
                        }}
                        className={`mb-2 flex-row items-center rounded-[14px] px-3 py-3 ${
                          isSelected ? "border border-blue-200 bg-blue-50" : "bg-gray-50"
                        }`}
                      >
                        <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-white">
                          <Ionicons name="person" size={18} color="#6B7280" />
                        </View>
                        <Text numberOfLines={1} className="flex-1 text-[15px] font-bold text-gray-900">
                          {item.name}
                        </Text>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
                        ) : null}
                      </Pressable>
                    );
                  }}
                  ListEmptyComponent={
                    <View className="items-center justify-center py-8">
                      <Ionicons name="people-outline" size={28} color="#9CA3AF" />
                      <Text className="mt-2 text-[14px] font-semibold text-gray-500">
                        No members found
                      </Text>
                    </View>
                  }
                />
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <Pressable
          onPress={() => {
            if (!saving) {
              setDeleteConfirmVisible(false);
              setDeleteTarget(null);
            }
          }}
          className="flex-1 justify-center bg-black/45 p-5"
        >
          <Pressable
            onPress={() => {}}
            className="w-full max-w-[360px] self-center rounded-[20px] bg-white p-5"
            style={{
              elevation: 8,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <View className="mb-3 items-center">
              <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <Ionicons name="alert-circle-outline" size={30} color="#DC2626" />
              </View>
              <Text className="text-[18px] font-extrabold text-gray-900 text-center">
                Are you sure you want to delete?
              </Text>
              <Text className="mt-2 text-[14px] text-gray-500 text-center">
                This action cannot be undone.
              </Text>
            </View>

            <View className="mt-2 flex-row gap-2">
              <Pressable
                onPress={() => {
                  if (!saving) {
                    setDeleteConfirmVisible(false);
                    setDeleteTarget(null);
                  }
                }}
                disabled={saving}
                className="flex-1 h-12 items-center justify-center rounded-[14px] bg-gray-200"
              >
                <Text className="text-[15px] font-bold text-gray-900">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleDeleteGroup}
                disabled={saving}
                className="flex-1 h-12 items-center justify-center rounded-[14px] bg-red-600"
              >
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-[15px] font-bold text-white">Delete</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}