import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
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
import { db } from "../../lib/firebaseConfig";

type GroupKind = "ministry" | "coreGroup";

type UserOption = {
  id: string;
  name: string;
  role: string;
};

type SubgroupItem = {
  id: string;
  name: string;
  leaderId?: string;
  leaderName?: string;
  leaderRole?: string;
  memberIds: string[];
  memberNames: string[];
};

type GroupItem = {
  id: string;
  name: string;
  description?: string;
  leaderId?: string;
  leaderName?: string;
  leaderRole?: string;
  createdAt?: Timestamp;
  isActive?: boolean;
  kind: GroupKind;
  subgroups: SubgroupItem[];
};

type SubgroupDraft = {
  localId: string;
  leaderId: string;
  memberIds: string[];
};

type PickerMode = "groupLeader" | "subgroupLeader" | "subgroupMembers";

type SubGroupAssignment = {
  groupId: string;
  groupName: string;
  subgroupId: string;
  subgroupName: string;
  leaderId: string;
  leaderName: string;
  leaderRole: string;
};

const getMemberName = (raw: any) => {
  return String(
    raw?.name ??
      raw?.fullName ??
      raw?.memberName ??
      raw?.username ??
      raw?.email ??
      "Unnamed"
  );
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

const makeLocalId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const indexToLetters = (index: number) => {
  let n = index;
  let result = "";
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
};

const groupConfig: Record<
  GroupKind,
  {
    collectionName: string;
    label: string;
    emptyText: string;
    placeholder: string;
  }
> = {
  ministry: {
    collectionName: "ministries",
    label: "Ministry",
    emptyText: "No ministry yet",
    placeholder: "Ministry name",
  },
  coreGroup: {
    collectionName: "coreGroups",
    label: "Core Group",
    emptyText: "No core group yet",
    placeholder: "Core group name",
  },
};

export default function ManageGroup() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [loading, setLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState(false);

  const [activeKind, setActiveKind] = useState<GroupKind>("ministry");
  const [ministries, setMinistries] = useState<GroupItem[]>([]);
  const [coreGroups, setCoreGroups] = useState<GroupItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [selectedLeaderId, setSelectedLeaderId] = useState("");
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [newGroupIsActive, setNewGroupIsActive] = useState(true);
  const [subgroupDrafts, setSubgroupDrafts] = useState<SubgroupDraft[]>([
    { localId: makeLocalId(), leaderId: "", memberIds: [] },
  ]);

  const [showUserPickerModal, setShowUserPickerModal] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>("groupLeader");
  const [pickerSubgroupIndex, setPickerSubgroupIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);

  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const activeGroups = activeKind === "ministry" ? ministries : coreGroups;
  const activeInfo = groupConfig[activeKind];

  const userMap = useMemo(() => {
    return new Map(users.map((user) => [user.id, user]));
  }, [users]);

  const selectedLeader = useMemo(
    () => userMap.get(selectedLeaderId) || null,
    [userMap, selectedLeaderId]
  );

  const filteredUsers = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => `${u.name} ${u.role}`.toLowerCase().includes(q));
  }, [users, pickerSearch]);

  const takenMemberIds = useMemo(() => {
    if (pickerMode !== "subgroupMembers" || pickerSubgroupIndex === null) {
      return new Set<string>();
    }

    const ids = new Set<string>();
    subgroupDrafts.forEach((draft, index) => {
      if (index === pickerSubgroupIndex) return;
      draft.memberIds.forEach((memberId) => ids.add(memberId));
    });
    return ids;
  }, [pickerMode, pickerSubgroupIndex, subgroupDrafts]);

  const getUniqueGroupMemberIds = useCallback((group: GroupItem) => {
    const ids = group.subgroups.flatMap((subgroup) => subgroup.memberIds ?? []);
    return Array.from(new Set(ids));
  }, []);

  const getGroupMemberCount = useCallback(
    (group: GroupItem) => getUniqueGroupMemberIds(group).length,
    [getUniqueGroupMemberIds]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ministrySnap, coreGroupSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "ministries")),
        getDocs(collection(db, "coreGroups")),
        getDocs(collection(db, "users")),
      ]);

      const userData: UserOption[] = usersSnap.docs
        .map((d) => {
          const raw = d.data() as any;
          return {
            id: d.id,
            name: getMemberName(raw),
            role: String(raw?.role ?? ""),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const lookup = new Map(userData.map((u) => [u.id, u]));

      const parseSubgroups = (rawSubgroups: any[]): SubgroupItem[] => {
        if (!Array.isArray(rawSubgroups)) return [];
        return rawSubgroups
          .map((subgroup: any, index: number) => {
            const memberIds = Array.isArray(subgroup?.memberIds)
              ? subgroup.memberIds.map((x: any) => String(x)).filter(Boolean)
              : [];
            const storedMemberNames = Array.isArray(subgroup?.memberNames)
              ? subgroup.memberNames.map((x: any) => String(x)).filter(Boolean)
              : [];
            const memberNames =
              storedMemberNames.length > 0
                ? storedMemberNames
                : memberIds
                    .map((memberId: string) => lookup.get(memberId)?.name ?? "")
                    .filter(Boolean);

            return {
              id: String(subgroup?.id ?? `${Date.now()}-${index}`),
              name: `Group ${indexToLetters(index)}`,
              leaderId: String(subgroup?.leaderId ?? ""),
              leaderName: String(subgroup?.leaderName ?? ""),
              leaderRole: String(subgroup?.leaderRole ?? ""),
              memberIds,
              memberNames,
            } as SubgroupItem;
          })
          .filter((x) => x.name);
      };

      const ministryData: GroupItem[] = ministrySnap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            kind: "ministry" as const,
            name: String(data?.name ?? "").trim(),
            description: String(data?.description ?? "").trim(),
            leaderId: String(data?.leaderId ?? ""),
            leaderName: String(data?.leaderName ?? ""),
            leaderRole: String(data?.leaderRole ?? ""),
            createdAt: data?.createdAt,
            isActive: data?.isActive ?? true,
            subgroups: parseSubgroups(data?.subgroups ?? []),
          };
        })
        .filter((x) => x.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      const coreGroupData: GroupItem[] = coreGroupSnap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            kind: "coreGroup" as const,
            name: String(data?.name ?? "").trim(),
            description: String(data?.description ?? "").trim(),
            leaderId: String(data?.leaderId ?? ""),
            leaderName: String(data?.leaderName ?? ""),
            leaderRole: String(data?.leaderRole ?? ""),
            createdAt: data?.createdAt,
            isActive: data?.isActive ?? true,
            subgroups: parseSubgroups(data?.subgroups ?? []),
          };
        })
        .filter((x) => x.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      setUsers(userData);
      setMinistries(ministryData);
      setCoreGroups(coreGroupData);
    } catch (error) {
      Alert.alert("Error", `Failed to load group data\n${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openCreateModal = (kind: GroupKind = activeKind) => {
    setActiveKind(kind);
    setEditingGroup(null);
    setNewGroupName("");
    setNewGroupDescription("");
    setSelectedLeaderId("");
    setNewGroupIsActive(true);
    setSubgroupDrafts([{ localId: makeLocalId(), leaderId: "", memberIds: [] }]);
    setExpandedGroupId(null);
    setShowAddModal(true);
  };

  const openEditModal = (group: GroupItem) => {
    setActiveKind(group.kind);
    setEditingGroup(group);
    setNewGroupName(group.name);
    setNewGroupDescription(group.description ?? "");
    setSelectedLeaderId(group.leaderId ?? "");
    setNewGroupIsActive(group.isActive ?? true);
    setSubgroupDrafts(
      group.subgroups.length > 0
        ? group.subgroups.map((subgroup) => ({
            localId: subgroup.id || makeLocalId(),
            leaderId: subgroup.leaderId ?? "",
            memberIds: subgroup.memberIds,
          }))
        : [{ localId: makeLocalId(), leaderId: "", memberIds: [] }]
    );
    setExpandedGroupId(null);
    setShowAddModal(true);
  };

  const openUserPicker = (mode: PickerMode, subgroupIndex: number | null = null) => {
    setPickerMode(mode);
    setPickerSubgroupIndex(subgroupIndex);
    setPickerSearch("");

    if (mode === "groupLeader") {
      setPickerSelectedIds(selectedLeaderId ? [selectedLeaderId] : []);
    } else if (mode === "subgroupLeader" && subgroupIndex !== null) {
      setPickerSelectedIds(
        subgroupDrafts[subgroupIndex]?.leaderId ? [subgroupDrafts[subgroupIndex].leaderId] : []
      );
    } else if (mode === "subgroupMembers" && subgroupIndex !== null) {
      setPickerSelectedIds(subgroupDrafts[subgroupIndex]?.memberIds ?? []);
    } else {
      setPickerSelectedIds([]);
    }

    setShowUserPickerModal(true);
  };

  const closeUserPicker = () => {
    setShowUserPickerModal(false);
    setPickerSearch("");
    setPickerSubgroupIndex(null);
  };

  const confirmUserPicker = () => {
    if (pickerMode === "groupLeader") {
      const chosenId = pickerSelectedIds[0] ?? "";
      if (!chosenId) return Alert.alert("Error", "Please select a leader");
      setSelectedLeaderId(chosenId);
      closeUserPicker();
      return;
    }

    if (pickerMode === "subgroupLeader") {
      const chosenId = pickerSelectedIds[0] ?? "";
      if (!chosenId) return Alert.alert("Error", "Please select a subgroup leader");
      if (pickerSubgroupIndex === null) return;
      setSubgroupDrafts((prev) =>
        prev.map((item, index) =>
          index === pickerSubgroupIndex ? { ...item, leaderId: chosenId } : item
        )
      );
      closeUserPicker();
      return;
    }

    if (pickerMode === "subgroupMembers") {
      if (pickerSubgroupIndex === null) return;
      setSubgroupDrafts((prev) =>
        prev.map((item, index) =>
          index === pickerSubgroupIndex ? { ...item, memberIds: [...pickerSelectedIds] } : item
        )
      );
      closeUserPicker();
    }
  };

  const addSubgroup = () => {
    setSubgroupDrafts((prev) => [
      ...prev,
      { localId: makeLocalId(), leaderId: "", memberIds: [] },
    ]);
  };

  const removeSubgroup = (index: number) => {
    setSubgroupDrafts((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const togglePickerUser = (userId: string) => {
    if (pickerMode === "subgroupMembers") {
      if (takenMemberIds.has(userId) && !pickerSelectedIds.includes(userId)) {
        return;
      }

      setPickerSelectedIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      );
      return;
    }

    if (pickerSelectedIds[0] === userId) {
      setPickerSelectedIds([]);
      return;
    }

    setPickerSelectedIds([userId]);
  };

  const saveGroup = async () => {
    const name = newGroupName.trim();
    const description = newGroupDescription.trim() || "No Description Provided";

    if (!name) {
      return Alert.alert("Error", `Please enter ${activeInfo.label.toLowerCase()} name`);
    }

    if (!selectedLeaderId) {
      return Alert.alert("Error", "Please select a leader");
    }

    const leader = users.find((u) => u.id === selectedLeaderId);
    if (!leader) return Alert.alert("Error", "Selected leader not found");

    if (subgroupDrafts.length === 0) {
      return Alert.alert("Error", "Please add at least one subgroup");
    }

    for (let i = 0; i < subgroupDrafts.length; i++) {
      const subgroup = subgroupDrafts[i];
      if (!subgroup.leaderId) {
        return Alert.alert("Error", `Please select a leader for Group ${indexToLetters(i)}`);
      }
      if (!subgroup.memberIds.length) {
        return Alert.alert("Error", `Please select members for Group ${indexToLetters(i)}`);
      }
    }

    const seenMemberIds = new Set<string>();
    for (let i = 0; i < subgroupDrafts.length; i++) {
      for (const memberId of subgroupDrafts[i].memberIds) {
        if (seenMemberIds.has(memberId)) {
          const memberName = users.find((u) => u.id === memberId)?.name ?? "A member";
          return Alert.alert(
            "Error",
            `${memberName} is already selected in another subgroup.`
          );
        }
        seenMemberIds.add(memberId);
      }
    }

    const currentList = activeKind === "ministry" ? ministries : coreGroups;
    const exists = currentList.some((group) => {
      if (editingGroup && group.id === editingGroup.id) return false;
      return group.name.toLowerCase() === name.toLowerCase();
    });

    if (exists) return Alert.alert("Error", `${activeInfo.label} already exists`);

    setSavingGroup(true);
    try {
      const groupRef = editingGroup
        ? doc(db, activeInfo.collectionName, editingGroup.id)
        : doc(collection(db, activeInfo.collectionName));

      const resolvedSubgroups = subgroupDrafts.map((subgroup, index) => {
        const subgroupLeader = users.find((u) => u.id === subgroup.leaderId);
        const subgroupMembers = subgroup.memberIds
          .map((memberId) => users.find((u) => u.id === memberId))
          .filter((x): x is UserOption => Boolean(x));

        return {
          id: subgroup.localId || makeLocalId(),
          name: `Group ${indexToLetters(index)}`,
          leaderId: subgroupLeader?.id ?? "",
          leaderName: subgroupLeader?.name ?? "",
          leaderRole: subgroupLeader?.role ?? "",
          memberIds: Array.from(new Set(subgroup.memberIds)),
          memberNames: subgroupMembers.map((member) => member.name),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
      });

      const payload = {
        name,
        description,
        leaderId: leader.id,
        leaderName: leader.name,
        leaderRole: leader.role,
        isActive: newGroupIsActive,
        createdAt: editingGroup?.createdAt ?? Timestamp.now(),
        updatedAt: Timestamp.now(),
        subgroups: resolvedSubgroups,
      };

      if (editingGroup) {
        await updateDoc(groupRef, payload);
      } else {
        await setDoc(groupRef, payload);
      }

      const nextAssignments = new Map<string, SubGroupAssignment>();
      resolvedSubgroups.forEach((subgroup) => {
        subgroup.memberIds.forEach((memberId) => {
          nextAssignments.set(memberId, {
            groupId: groupRef.id,
            groupName: name,
            subgroupId: subgroup.id,
            subgroupName: subgroup.name,
            leaderId: subgroup.leaderId,
            leaderName: subgroup.leaderName,
            leaderRole: subgroup.leaderRole,
          });
        });
      });

      const previousMemberIds = editingGroup
        ? Array.from(
            new Set(editingGroup.subgroups.flatMap((subgroup) => subgroup.memberIds ?? []))
          )
        : [];

      try {
        const batch = writeBatch(db);

        for (const userId of previousMemberIds) {
          if (!nextAssignments.has(userId)) {
            batch.set(
              doc(db, "users", userId),
              {
                subGroup: {
                  [activeKind]: deleteField(),
                },
              },
              { merge: true }
            );
          }
        }

        for (const [userId, assignment] of nextAssignments.entries()) {
          batch.set(
            doc(db, "users", userId),
            {
              subGroup: {
                [activeKind]: assignment,
              },
            },
            { merge: true }
          );
        }

        await batch.commit();
      } catch (error) {
        Alert.alert(
          "Saved",
          `${activeInfo.label} was saved, but member assignments failed.\n${getErrorMessage(error)}`
        );
        return;
      }

      setNewGroupName("");
      setNewGroupDescription("");
      setSelectedLeaderId("");
      setEditingGroup(null);
      setNewGroupIsActive(true);
      setSubgroupDrafts([{ localId: makeLocalId(), leaderId: "", memberIds: [] }]);
      setShowAddModal(false);
      await loadData();
    } catch (error) {
      Alert.alert("Error", `Failed to save ${activeInfo.label.toLowerCase()}\n${getErrorMessage(error)}`);
    } finally {
      setSavingGroup(false);
    }
  };

  const openGroupBoard = (group: GroupItem) => {
    const route = group.isActive ? "./task-board" : "./task-list";

    router.push({
      pathname: route,
      params: {
        id: id ? String(id) : "",
        groupId: group.id,
        groupName: group.name,
        groupKind: group.kind,
      },
    });
  };

  const selectedPickerTitle =
    pickerMode === "groupLeader"
      ? `Select ${activeInfo.label} Leader`
      : pickerMode === "subgroupLeader"
        ? `Select Group ${
            pickerSubgroupIndex !== null ? indexToLetters(pickerSubgroupIndex) : ""
          } Leader`
        : `Select Group ${
            pickerSubgroupIndex !== null ? indexToLetters(pickerSubgroupIndex) : ""
          } Members`;

  return (
    <View className="flex-1 bg-[#F7F8FA]">
      <ScrollView className="flex-1" contentContainerClassName="px-5 pt-5 pb-[110px]">
        <Text className="text-2xl font-extrabold text-gray-900">Manage Group</Text>

        <View className="mt-3 flex-row gap-2.5">
          <Pressable
            onPress={() => setActiveKind("ministry")}
            className={`flex-1 items-center rounded-[14px] px-3 py-3.5 ${
              activeKind === "ministry" ? "bg-gray-900" : "bg-gray-200"
            }`}
          >
            <Text
              className={`font-bold ${
                activeKind === "ministry" ? "text-white" : "text-gray-900"
              }`}
            >
              Ministries
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveKind("coreGroup")}
            className={`flex-1 items-center rounded-[14px] px-3 py-3.5 ${
              activeKind === "coreGroup" ? "bg-gray-900" : "bg-gray-200"
            }`}
          >
            <Text
              className={`font-bold ${
                activeKind === "coreGroup" ? "text-white" : "text-gray-900"
              }`}
            >
              Core Groups
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View className="py-5">
            <ActivityIndicator />
          </View>
        ) : activeGroups.length === 0 ? (
          <Text className="text-gray-500">{activeInfo.emptyText}</Text>
        ) : (
          <View className="mt-1 gap-3">
            {activeGroups.map((group) => {
              const expanded = expandedGroupId === group.id;
              const groupMemberCount = getGroupMemberCount(group);

              return (
                <View key={group.id} className="relative">
                  <Pressable
                    onPress={() => openGroupBoard(group)}
                    className="relative gap-2 rounded-[14px] border border-gray-200 bg-white p-[14px]"
                  >
                    <Text className="pr-12 text-[18px] font-bold text-gray-900">
                      {group.name}
                    </Text>

                    {!!group.description && (
                      <Text className="pr-2 text-sm leading-5 text-gray-600">
                        {group.description}
                      </Text>
                    )}

                    <View className="mt-0.5 flex-row flex-wrap gap-2 pr-12">
                      <View className="flex-row items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1.5">
                        <Ionicons name="people-outline" size={14} color="#111827" />
                        <Text className="text-xs font-extrabold text-gray-900">
                          {group.subgroups.length} subgroups
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1.5">
                        <Ionicons name="person" size={14} color="#111827" />
                        <Text className="text-xs font-extrabold text-gray-900">
                          {groupMemberCount} members
                        </Text>
                      </View>
                    </View>

                    <View className="mt-0.5 pr-12">
                      <View className="flex-row items-center gap-1.5">
                        <Ionicons
                          name="person-circle-outline"
                          size={16}
                          color="#6B7280"
                        />
                        <Text className="text-[13px] font-semibold text-gray-500">
                          {group.leaderName || "Not set"}
                        </Text>
                      </View>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => openEditModal(group)}
                    className="absolute right-2.5 top-2.5 z-[3] h-[34px] w-[34px] items-center justify-center rounded-full bg-gray-100"
                  >
                    <Ionicons name="create-outline" size={18} color="#111827" />
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      setExpandedGroupId((prev) => (prev === group.id ? null : group.id))
                    }
                    className="absolute right-2.5 top-[50px] z-[3] h-[34px] w-[34px] items-center justify-center rounded-full bg-gray-100"
                  >
                    <Ionicons
                      name={expanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color="#111827"
                    />
                  </Pressable>

                  {expanded ? (
                    <View className="mt-2.5 flex-row flex-wrap justify-between gap-2.5">
                      {group.subgroups.length === 0 ? (
                        <Text className="text-gray-500">No subgroups yet</Text>
                      ) : (
                        group.subgroups.map((subgroup, index) => {
                          const subgroupMemberCount = subgroup.memberIds.length;

                          return (
                            <View
                              key={subgroup.id}
                              className="relative min-h-[140px] basis-[48%] flex-shrink-0 flex-grow-0 gap-2 rounded-[14px] border border-gray-200 bg-[#FAFAFA] p-2.5"
                            >
                              <View className="flex-row items-start justify-between gap-2 pr-0.5">
                                <Text className="flex-1 text-sm font-extrabold text-gray-900">
                                  {subgroup.name || `Group ${indexToLetters(index)}`}
                                </Text>
                                <View className="flex-row items-center gap-1 rounded-full bg-gray-200 px-2 py-1">
                                  <Ionicons name="people-outline" size={13} color="#111827" />
                                  <Text className="text-xs font-extrabold text-gray-900">
                                    {subgroupMemberCount}
                                  </Text>
                                </View>
                              </View>

                              <View className="flex-row items-center gap-1.5">
                                <Ionicons
                                  name="person-circle-outline"
                                  size={15}
                                  color="#4B5563"
                                />
                                <Text className="flex-1 text-xs font-bold text-gray-600">
                                  {subgroup.leaderName || "Not set"}
                                </Text>
                              </View>

                              <View className="gap-1.5">
                                {subgroup.memberNames.length > 0 ? (
                                  subgroup.memberNames.map((memberName, memberIndex) => (
                                    <View
                                      key={`${subgroup.id}-${memberIndex}`}
                                      className="flex-row items-center gap-2"
                                    >
                                      <View className="h-6 w-6 items-center justify-center rounded-full bg-gray-200">
                                        <Ionicons name="person" size={14} color="#9CA3AF" />
                                      </View>
                                      <Text className="flex-1 text-xs font-semibold leading-[18px] text-gray-900">
                                        {memberName}
                                      </Text>
                                    </View>
                                  ))
                                ) : (
                                  <Text className="text-gray-500">No members</Text>
                                )}
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => openCreateModal(activeKind)}
        className="absolute bottom-5 right-5 h-[60px] w-[60px] items-center justify-center rounded-full bg-gray-900 shadow-lg"
      >
        <Ionicons name="add" size={32} color="white" />
      </Pressable>

      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/45"
          onPress={() => setShowAddModal(false)}
        >
          <Pressable className="max-h-[90%] rounded-t-[24px] bg-white px-[18px] pb-[18px] pt-2.5">
            <View className="mb-3 self-center h-[5px] w-11 rounded-full bg-gray-300" />
            <Text className="mb-3 text-center text-xl font-extrabold text-gray-900">
              {editingGroup
                ? `Edit ${activeInfo.label}`
                : activeKind === "ministry"
                  ? "New Ministry"
                  : "New Core Group"}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-3 pb-2.5">
              <View className="gap-2">
                <Text className="text-[13px] font-extrabold text-gray-900">Name</Text>
                <TextInput
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  placeholder={activeInfo.placeholder}
                  className="rounded-[14px] border border-gray-200 bg-white px-4 py-3 text-[15px] text-gray-900"
                />
              </View>

              <View className="gap-2">
                <Text className="text-[13px] font-extrabold text-gray-900">Description</Text>
                <TextInput
                  value={newGroupDescription}
                  onChangeText={setNewGroupDescription}
                  placeholder="Write a short description"
                  multiline
                  textAlignVertical="top"
                  className="min-h-[96px] rounded-[14px] border border-gray-200 bg-white px-4 py-3 text-[15px] text-gray-900"
                />
              </View>

              <View className="gap-2">
                <Text className="text-[13px] font-extrabold text-gray-900">Leader</Text>
                <Pressable
                  onPress={() => openUserPicker("groupLeader")}
                  className="flex-row items-center justify-between gap-2 rounded-[14px] border border-gray-200 bg-white px-4 py-3"
                >
                  <Text
                    className={`flex-1 text-[15px] font-semibold ${
                      selectedLeader ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {selectedLeader ? selectedLeader.name : "Select from users"}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#6B7280" />
                </Pressable>
              </View>

              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[15px] font-extrabold text-gray-900">Subgroups</Text>
                  <Pressable
                    onPress={addSubgroup}
                    className="flex-row items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2"
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text className="text-[13px] font-extrabold text-white">Add</Text>
                  </Pressable>
                </View>

                {subgroupDrafts.map((subgroup, index) => {
                  const subgroupLeader =
                    users.find((user) => user.id === subgroup.leaderId) || null;
                  const subgroupMembers = subgroup.memberIds
                    .map((memberId) => users.find((user) => user.id === memberId))
                    .filter((x): x is UserOption => Boolean(x));

                  return (
                    <View
                      key={subgroup.localId}
                      className="gap-3 rounded-2xl border border-gray-200 bg-[#FAFAFA] p-3"
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[15px] font-extrabold text-gray-900">
                          Group {indexToLetters(index)}
                        </Text>
                        {subgroupDrafts.length > 1 ? (
                          <Pressable
                            onPress={() => removeSubgroup(index)}
                            className="h-[34px] w-[34px] items-center justify-center rounded-full bg-red-100"
                          >
                            <Ionicons name="trash-outline" size={18} color="#DC2626" />
                          </Pressable>
                        ) : null}
                      </View>

                      <View className="gap-2">
                        <Text className="text-[13px] font-extrabold text-gray-900">Leader</Text>
                        <Pressable
                          onPress={() => openUserPicker("subgroupLeader", index)}
                          className="flex-row items-center justify-between gap-2 rounded-[14px] border border-gray-200 bg-white px-4 py-3"
                        >
                          <Text
                            className={`flex-1 text-[15px] font-semibold ${
                              subgroupLeader ? "text-gray-900" : "text-gray-400"
                            }`}
                          >
                            {subgroupLeader ? subgroupLeader.name : "Select leader"}
                          </Text>
                          <Ionicons name="chevron-down" size={18} color="#6B7280" />
                        </Pressable>
                      </View>

                      <View className="gap-2">
                        <Text className="text-[13px] font-extrabold text-gray-900">Members</Text>
                        <Pressable
                          onPress={() => openUserPicker("subgroupMembers", index)}
                          className="flex-row items-center justify-between gap-2 rounded-[14px] border border-gray-200 bg-white px-4 py-3"
                        >
                          <Text
                            className={`flex-1 text-[15px] font-semibold ${
                              subgroupMembers.length > 0 ? "text-gray-900" : "text-gray-400"
                            }`}
                          >
                            {subgroupMembers.length > 0
                              ? `${subgroupMembers.length} selected`
                              : "Select members"}
                          </Text>
                          <Ionicons name="chevron-down" size={18} color="#6B7280" />
                        </Pressable>
                      </View>

                      <View className="gap-1.5">
                        {subgroupMembers.length > 0 ? (
                          subgroupMembers.map((member) => (
                            <View key={member.id} className="flex-row items-center gap-2">
                              <View className="h-6 w-6 items-center justify-center rounded-full bg-gray-200">
                                <Ionicons
                                  name="help-circle-outline"
                                  size={14}
                                  color="#9CA3AF"
                                />
                              </View>
                              <Text className="flex-1 text-xs font-semibold leading-[18px] text-gray-900">
                                {member.name}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <Text className="text-gray-500">No members selected</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              <View className="flex-row items-center gap-2 pt-1">
                <Pressable
                  onPress={() => setNewGroupIsActive((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={newGroupIsActive ? "Set inactive" : "Set active"}
                  className="h-[34px] w-[34px] items-center justify-center rounded-full border border-gray-200 bg-white"
                >
                  <View
                    className={`h-[14px] w-[14px] rounded-full ${
                      newGroupIsActive ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                </Pressable>

                <View className="flex-1" />

                <Pressable
                  onPress={() => setShowAddModal(false)}
                  className="rounded-[14px] bg-gray-200 px-4 py-3"
                >
                  <Text className="font-extrabold text-gray-900">Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={saveGroup}
                  disabled={savingGroup}
                  className={`rounded-[14px] bg-gray-900 px-4 py-3 ${
                    savingGroup ? "opacity-75" : ""
                  }`}
                >
                  <Text className="font-extrabold text-white">
                    {savingGroup ? "Saving..." : editingGroup ? "Update" : "Create"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showUserPickerModal}
        transparent
        animationType="slide"
        onRequestClose={closeUserPicker}
      >
        <Pressable className="flex-1 justify-end bg-black/45" onPress={closeUserPicker}>
          <Pressable className="max-h-[90%] rounded-t-[24px] bg-white px-[18px] pb-[18px] pt-2.5">
            <View className="mb-3 self-center h-[5px] w-11 rounded-full bg-gray-300" />
            <Text className="mb-3 text-center text-xl font-extrabold text-gray-900">
              {selectedPickerTitle}
            </Text>

            <View className="mb-2.5 flex-row h-[50px] items-center gap-2.5 rounded-[14px] border border-gray-200 bg-white px-4">
              <Ionicons name="search" size={18} color="#6B7280" />
              <TextInput
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search users"
                placeholderTextColor="#9CA3AF"
                className="flex-1 text-[15px] text-gray-900"
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-2.5 pb-2">
              {filteredUsers.length === 0 ? (
                <Text className="py-5 text-center text-gray-500">No users found</Text>
              ) : (
                filteredUsers.map((user) => {
                  const active = pickerSelectedIds.includes(user.id);
                  const disabled =
                    pickerMode === "subgroupMembers" &&
                    takenMemberIds.has(user.id) &&
                    !active;

                  return (
                    <Pressable
                      key={user.id}
                      onPress={() => {
                        if (disabled) return;
                        togglePickerUser(user.id);
                      }}
                      className={`flex-row items-center gap-3 rounded-[14px] border p-3 ${
                        disabled
                          ? "border-gray-100 bg-gray-50 opacity-50"
                          : active
                            ? "border-blue-200 bg-blue-50"
                            : "border-gray-200 bg-white"
                      }`}
                    >
                      <View className="h-[38px] w-[38px] items-center justify-center rounded-full bg-gray-100">
                        <Ionicons name="person" size={18} color="#9CA3AF" />
                      </View>

                      <View className="flex-1">
                        <Text className="text-[15px] font-extrabold text-gray-900">
                          {user.name}
                        </Text>
                        {!!user.role && (
                          <Text className="mt-0.5 text-[13px] font-semibold text-gray-500">
                            {user.role}
                          </Text>
                        )}
                        {disabled ? (
                          <Text className="mt-0.5 text-[12px] font-semibold text-red-500">
                            Already selected in another subgroup
                          </Text>
                        ) : null}
                      </View>

                      {pickerMode === "subgroupMembers" ? (
                        active ? (
                          <Ionicons name="checkbox" size={22} color="#16A34A" />
                        ) : (
                          <Ionicons name="square-outline" size={22} color="#9CA3AF" />
                        )
                      ) : active ? (
                        <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                      ) : (
                        <Ionicons name="ellipse-outline" size={22} color="#9CA3AF" />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <View className="flex-row items-center justify-end gap-2.5 pt-1.5">
              <Pressable
                onPress={closeUserPicker}
                className="rounded-[14px] bg-gray-200 px-4 py-3"
              >
                <Text className="font-extrabold text-gray-900">Close</Text>
              </Pressable>

              <Pressable onPress={confirmUserPicker} className="rounded-[14px] bg-gray-900 px-4 py-3">
                <Text className="font-extrabold text-white">
                  {pickerMode === "subgroupMembers" ? "Done" : "Select"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}