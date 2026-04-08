import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
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
  joinedGroups: string[];
  joinedText: string;
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

type MemberCard = {
  id: string;
  name: string;
  registered: boolean;
};

type PickerMode = "newSubgroupLeader" | "newSubgroupMembers" | "existingSubgroupMembers";

type SubGroupAssignment = {
  groupId: string;
  groupName: string;
  subgroupId: string;
  subgroupName: string;
  leaderId: string;
  leaderName: string;
  leaderRole: string;
};

const normalizeIds = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));

const getMemberName = (raw: any) => {
  return String(raw?.name ?? raw?.fullName ?? raw?.memberName ?? raw?.username ?? raw?.email ?? "Unnamed");
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

const getCollectionName = (kind: GroupKind) => (kind === "ministry" ? "ministries" : "coreGroups");

export default function Members() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    groupId?: string;
    groupKind?: string;
    groupName?: string;
  }>();

  const groupId = String(params.groupId ?? "");
  const groupKind = String(params.groupKind ?? "") as GroupKind;
  const groupNameParam = String(params.groupName ?? "");

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<GroupItem | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [savingAction, setSavingAction] = useState(false);

  const [showNewSubgroupModal, setShowNewSubgroupModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showUserPickerModal, setShowUserPickerModal] = useState(false);

  const [newSubgroupLeaderId, setNewSubgroupLeaderId] = useState("");
  const [newSubgroupMemberIds, setNewSubgroupMemberIds] = useState<string[]>([]);
  const [targetSubgroupIndex, setTargetSubgroupIndex] = useState<number | null>(null);
  const [memberSelectionIds, setMemberSelectionIds] = useState<string[]>([]);

  const [pickerMode, setPickerMode] = useState<PickerMode>("newSubgroupLeader");
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    if (!groupId || !groupKind) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const groupRef = doc(db, getCollectionName(groupKind), groupId);
      const [groupSnap, usersSnap] = await Promise.all([getDoc(groupRef), getDocs(collection(db, "users"))]);

      if (!groupSnap.exists()) {
        setGroup(null);
        setUsers([]);
        setLoading(false);
        return;
      }

      const data = groupSnap.data() as any;

      const userData: UserOption[] = usersSnap.docs
        .map((d) => {
          const raw = d.data() as any;
          const subGroup = raw?.subGroup ?? {};
          const ministryName = String(subGroup?.ministry?.groupName ?? "").trim();
          const coreGroupName = String(subGroup?.coreGroup?.groupName ?? "").trim();
          const joinedGroups = normalizeIds([ministryName, coreGroupName]);

          return {
            id: d.id,
            name: getMemberName(raw),
            role: String(raw?.role ?? ""),
            joinedGroups,
            joinedText: joinedGroups.join(", "),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const userLookup = new Map(userData.map((u) => [u.id, u]));

      const parsedGroup: GroupItem = {
        id: groupSnap.id,
        kind: groupKind,
        name: String(data?.name ?? groupNameParam ?? "").trim(),
        description: String(data?.description ?? "").trim(),
        leaderId: String(data?.leaderId ?? ""),
        leaderName: String(data?.leaderName ?? ""),
        leaderRole: String(data?.leaderRole ?? ""),
        createdAt: data?.createdAt,
        isActive: data?.isActive ?? true,
        subgroups: Array.isArray(data?.subgroups)
          ? data.subgroups.map((subgroup: any, index: number) => {
              const leaderId = String(subgroup?.leaderId ?? "");
              const memberIds = normalizeIds(
                Array.isArray(subgroup?.memberIds) ? subgroup.memberIds.map((x: any) => String(x)) : []
              ).filter((id) => id !== leaderId && id !== String(data?.leaderId ?? ""));

              const storedMemberNames = Array.isArray(subgroup?.memberNames)
                ? subgroup.memberNames.map((x: any) => String(x)).filter(Boolean)
                : [];

              const memberNames =
                storedMemberNames.length > 0
                  ? storedMemberNames.slice(0, memberIds.length)
                  : memberIds.map((memberId: string) => userLookup.get(memberId)?.name ?? "").filter(Boolean);

              return {
                id: String(subgroup?.id ?? `${groupSnap.id}-${index}`),
                name: String(subgroup?.name ?? `Group ${indexToLetters(index)}`),
                leaderId,
                leaderName: String(subgroup?.leaderName ?? ""),
                leaderRole: String(subgroup?.leaderRole ?? ""),
                memberIds,
                memberNames,
              } as SubgroupItem;
            })
          : [],
      };

      setGroup(parsedGroup);
      setUsers(userData);
    } catch (error) {
      Alert.alert("Error", `Failed to load members\n${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [groupId, groupKind, groupNameParam]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const uniqueMemberIds = useMemo(() => {
    if (!group) return [];
    return normalizeIds(group.subgroups.flatMap((subgroup) => subgroup.memberIds ?? []));
  }, [group]);

  const subgroupBlocks = useMemo(() => {
    if (!group) return [];

    return group.subgroups.map((subgroup) => {
      const members: MemberCard[] = subgroup.memberIds.map((memberId, index) => {
        const user = userMap.get(memberId);
        return {
          id: memberId,
          name: user?.name ?? subgroup.memberNames[index] ?? "Unnamed",
          registered: Boolean(user),
        };
      });

      return {
        ...subgroup,
        members,
      };
    });
  }, [group, userMap]);

  const registeredCount = useMemo(() => {
    return uniqueMemberIds.filter((id) => userMap.has(id)).length;
  }, [uniqueMemberIds, userMap]);

  const unregisteredCount = useMemo(() => {
    return uniqueMemberIds.filter((id) => !userMap.has(id)).length;
  }, [uniqueMemberIds, userMap]);

  const activeSubgroup = useMemo(() => {
    if (targetSubgroupIndex === null || !group) return null;
    return group.subgroups[targetSubgroupIndex] ?? null;
  }, [group, targetSubgroupIndex]);

  const getBlockedIds = useCallback(
    (excludeSubgroupIndex: number | null) => {
      const ids = new Set<string>();

      if (group?.leaderId) {
        ids.add(group.leaderId);
      }

      if (!group) return ids;

      group.subgroups.forEach((subgroup, index) => {
        if (subgroup.leaderId) {
          ids.add(subgroup.leaderId);
        }

        if (excludeSubgroupIndex === null || index !== excludeSubgroupIndex) {
          subgroup.memberIds.forEach((memberId) => ids.add(memberId));
        }
      });

      return ids;
    },
    [group]
  );

  const filteredUsers = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => `${u.name} ${u.role} ${u.joinedText}`.toLowerCase().includes(q));
  }, [users, pickerSearch]);

  const openMember = (memberId: string) => {
    router.push({
      pathname: "admin/member",
      params: {
        memberId,
        groupId,
        groupKind,
        groupName: group?.name ?? groupNameParam,
      },
    });
  };

  const openCreateSubgroupModal = () => {
    setNewSubgroupLeaderId("");
    setNewSubgroupMemberIds([]);
    setShowNewSubgroupModal(true);
  };

  const openAddMembersModal = (subgroupIndex: number) => {
    if (!group) return;
    setTargetSubgroupIndex(subgroupIndex);
    setMemberSelectionIds(normalizeIds(group.subgroups[subgroupIndex]?.memberIds ?? []));
    setShowAddMembersModal(true);
  };

  const closeNewSubgroupModal = () => {
    setShowNewSubgroupModal(false);
    setPickerSearch("");
    setPickerSelectedIds([]);
    setPickerTargetIndex(null);
  };

  const closeAddMembersModal = () => {
    setShowAddMembersModal(false);
    setPickerSearch("");
    setPickerSelectedIds([]);
    setPickerTargetIndex(null);
    setTargetSubgroupIndex(null);
  };

  const closeUserPicker = () => {
    setShowUserPickerModal(false);
    setPickerSearch("");
    setPickerTargetIndex(null);
  };

  const openUserPicker = (mode: PickerMode, subgroupIndex: number | null = null) => {
    setPickerMode(mode);
    setPickerTargetIndex(subgroupIndex);
    setPickerSearch("");

    if (mode === "newSubgroupLeader") {
      setPickerSelectedIds(newSubgroupLeaderId ? [newSubgroupLeaderId] : []);
    } else if (mode === "newSubgroupMembers") {
      setPickerSelectedIds(newSubgroupMemberIds);
    } else if (mode === "existingSubgroupMembers") {
      setPickerSelectedIds(memberSelectionIds);
    } else {
      setPickerSelectedIds([]);
    }

    setShowUserPickerModal(true);
  };

  const confirmUserPicker = () => {
    const chosenIds = normalizeIds(pickerSelectedIds);

    if (pickerMode === "newSubgroupLeader") {
      const chosenId = chosenIds[0] ?? "";
      if (!chosenId) return Alert.alert("Error", "Please select a subgroup leader");
      setNewSubgroupLeaderId(chosenId);
      closeUserPicker();
      return;
    }

    if (pickerMode === "newSubgroupMembers") {
      if (chosenIds.length === 0) return Alert.alert("Error", "Please select members");
      const blocked = getBlockedIds(null);
      const allowed = chosenIds.filter((id) => !blocked.has(id));
      setNewSubgroupMemberIds(allowed);
      closeUserPicker();
      return;
    }

    if (pickerMode === "existingSubgroupMembers") {
      if (targetSubgroupIndex === null) return;
      const blocked = getBlockedIds(targetSubgroupIndex);
      const allowed = chosenIds.filter((id) => !blocked.has(id) || memberSelectionIds.includes(id));
      setMemberSelectionIds(allowed);
      closeUserPicker();
    }
  };

  const togglePickerUser = (userId: string) => {
    if (pickerMode === "newSubgroupLeader") {
      setPickerSelectedIds([userId]);
      return;
    }

    if (pickerSelectedIds.includes(userId)) {
      setPickerSelectedIds((prev) => prev.filter((id) => id !== userId));
    } else {
      setPickerSelectedIds((prev) => [...prev, userId]);
    }
  };

  const getCurrentAssignments = useCallback(
    (subgroups: SubgroupItem[]) => {
      const nextAssignments = new Map<string, SubGroupAssignment>();

      subgroups.forEach((subgroup) => {
        subgroup.memberIds.forEach((memberId) => {
          nextAssignments.set(memberId, {
            groupId,
            groupName: group?.name ?? groupNameParam,
            subgroupId: subgroup.id,
            subgroupName: subgroup.name,
            leaderId: subgroup.leaderId ?? "",
            leaderName: subgroup.leaderName ?? "",
            leaderRole: subgroup.leaderRole ?? "",
          });
        });
      });

      return nextAssignments;
    },
    [group?.name, groupNameParam, groupId]
  );

  const saveAssignments = useCallback(
    async (nextSubgroups: SubgroupItem[], previousSubgroups: SubgroupItem[]) => {
      const nextAssignments = getCurrentAssignments(nextSubgroups);
      const previousMemberIds = normalizeIds(previousSubgroups.flatMap((subgroup) => subgroup.memberIds ?? []));

      const batch = writeBatch(db);

      for (const userId of previousMemberIds) {
        if (!nextAssignments.has(userId)) {
          batch.set(
            doc(db, "users", userId),
            {
              subGroup: {
                [groupKind]: deleteField(),
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
              [groupKind]: assignment,
            },
          },
          { merge: true }
        );
      }

      await batch.commit();
    },
    [getCurrentAssignments, groupKind]
  );

  const persistSubgroups = useCallback(
    async (nextSubgroups: SubgroupItem[]) => {
      if (!group) return;

      const groupRef = doc(db, getCollectionName(groupKind), group.id);
      await updateDoc(groupRef, {
        subgroups: nextSubgroups,
        updatedAt: Timestamp.now(),
      });

      await saveAssignments(nextSubgroups, group.subgroups);
    },
    [group, groupKind, saveAssignments]
  );

  const createSubgroup = async () => {
    if (!group) return;

    const leaderId = newSubgroupLeaderId.trim();
    const memberIds = normalizeIds(newSubgroupMemberIds);

    if (!leaderId) {
      return Alert.alert("Error", "Please select a subgroup leader");
    }

    if (memberIds.length === 0) {
      return Alert.alert("Error", "Please select members");
    }

    const blocked = getBlockedIds(null);

    if (blocked.has(leaderId)) {
      return Alert.alert("Error", "Selected leader is already used in this group");
    }

    const invalidMember = memberIds.find((id) => blocked.has(id));
    if (invalidMember) {
      return Alert.alert("Error", "One or more selected members are already used in this group");
    }

    if (memberIds.includes(leaderId)) {
      return Alert.alert("Error", "Leader cannot also be a member of the same subgroup");
    }

    const leader = users.find((u) => u.id === leaderId);
    if (!leader) return Alert.alert("Error", "Selected leader not found");

    const selectedMembers = memberIds
      .map((memberId) => users.find((u) => u.id === memberId))
      .filter((x): x is UserOption => Boolean(x));

    const newSubgroup: SubgroupItem = {
      id: makeLocalId(),
      name: `Group ${indexToLetters(group.subgroups.length)}`,
      leaderId: leader.id,
      leaderName: leader.name,
      leaderRole: leader.role,
      memberIds,
      memberNames: selectedMembers.map((member) => member.name),
    };

    const nextSubgroups = [...group.subgroups, newSubgroup];

    setSavingAction(true);
    try {
      await persistSubgroups(nextSubgroups);
      closeNewSubgroupModal();
      await loadData();
    } catch (error) {
      Alert.alert("Error", `Failed to add subgroup\n${getErrorMessage(error)}`);
    } finally {
      setSavingAction(false);
    }
  };

  const saveMembersToSubgroup = async () => {
    if (!group || targetSubgroupIndex === null) return;

    const target = group.subgroups[targetSubgroupIndex];
    if (!target) return;

    const existingMemberIds = normalizeIds(target.memberIds ?? []);
    const blocked = getBlockedIds(targetSubgroupIndex);

    const allowedSelection = normalizeIds(memberSelectionIds).filter(
      (id) => !blocked.has(id) || existingMemberIds.includes(id)
    );

    const nextMemberIds = normalizeIds([...existingMemberIds, ...allowedSelection]).filter(
      (id) => id !== target.leaderId && id !== group.leaderId
    );

    if (nextMemberIds.length === 0) {
      return Alert.alert("Error", "Please select members");
    }

    const invalidMember = nextMemberIds.find((id) => blocked.has(id) && !existingMemberIds.includes(id));
    if (invalidMember) {
      return Alert.alert("Error", "One or more selected members are already used in this group");
    }

    const nextSubgroup: SubgroupItem = {
      ...target,
      memberIds: nextMemberIds,
      memberNames: nextMemberIds.map((memberId) => users.find((u) => u.id === memberId)?.name ?? "").filter(Boolean),
    };

    const nextSubgroups = group.subgroups.map((subgroup, index) =>
      index === targetSubgroupIndex ? nextSubgroup : subgroup
    );

    setSavingAction(true);
    try {
      await persistSubgroups(nextSubgroups);
      closeAddMembersModal();
      await loadData();
    } catch (error) {
      Alert.alert("Error", `Failed to update members\n${getErrorMessage(error)}`);
    } finally {
      setSavingAction(false);
    }
  };

  const selectedPickerTitle =
    pickerMode === "newSubgroupLeader"
      ? "Select Subgroup Leader"
      : pickerMode === "newSubgroupMembers"
        ? "Select Subgroup Members"
        : `Select Members for ${activeSubgroup?.name ?? "Subgroup"}`;

  const pickerBlockedIds = useMemo(() => {
    if (pickerMode === "existingSubgroupMembers") {
      return getBlockedIds(pickerTargetIndex);
    }
    return getBlockedIds(null);
  }, [getBlockedIds, pickerMode, pickerTargetIndex]);

  const pickerSelectedUsers = useMemo(
    () => pickerSelectedIds.map((id) => userMap.get(id)).filter(Boolean) as UserOption[],
    [pickerSelectedIds, userMap]
  );

  const selectedLeader = newSubgroupLeaderId ? userMap.get(newSubgroupLeaderId) : null;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F7F8FA]">
        <ActivityIndicator />
      </View>
    );
  }

  if (!group) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F7F8FA] px-6">
        <Ionicons name="people-outline" size={38} color="#9CA3AF" />
        <Text className="mt-3 text-center text-[16px] font-extrabold text-gray-900">
          Group not found
        </Text>
        <Text className="mt-1 text-center text-[14px] text-gray-500">
          The selected group may have been deleted or the link is missing an id.
        </Text>
      </View>
    );
  }

  const totalMembers = uniqueMemberIds.length;
  const leaderName = group.leaderName || "Not set";

  return (
    <View className="flex-1 bg-[#F7F8FA]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-5 pb-[100px]"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-4 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-2xl font-extrabold text-gray-900">{group.name}</Text>
            {!!group.description && (
              <Text className="mt-1 text-[14px] leading-5 text-gray-600">{group.description}</Text>
            )}
          </View>
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1 items-center rounded-[18px] border border-blue-100 bg-blue-50 p-4">
            <Text className="text-center text-[13px] font-extrabold text-blue-700">All Members</Text>
            <Text className="mt-2 text-center text-[28px] font-extrabold text-gray-900">{totalMembers}</Text>
          </View>

          <View className="flex-1 items-center rounded-[18px] border border-emerald-100 bg-emerald-50 p-4">
            <Text className="text-center text-[13px] font-extrabold text-emerald-700">Registered</Text>
            <Text className="mt-2 text-center text-[28px] font-extrabold text-gray-900">{registeredCount}</Text>
          </View>

          <View className="flex-1 items-center rounded-[18px] border border-amber-100 bg-amber-50 p-4">
            <Text className="text-center text-[13px] font-extrabold text-amber-700">Unregistered</Text>
            <Text className="mt-2 text-center text-[28px] font-extrabold text-gray-900">{unregisteredCount}</Text>
          </View>
        </View>

        <View className="mt-5 rounded-[18px] border border-gray-200 bg-white p-4">
          <View className="flex-row items-start gap-3">
            <View className="flex-1 flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-gray-900">
                <Ionicons name="person-circle-outline" size={28} color="white" />
              </View>

              <View className="flex-1">
                <Text className="text-[13px] font-bold uppercase tracking-[1px] text-gray-500">
                  Head / Leader
                </Text>
                <Text className="mt-0.5 text-[18px] font-extrabold text-gray-900">{leaderName}</Text>
              </View>
            </View>

            <Pressable
              onPress={openCreateSubgroupModal}
              className="mt-1 h-10 w-10 items-center justify-center rounded-full bg-gray-100"
            >
              <Ionicons name="add" size={24} color="#111827" />
            </Pressable>
          </View>
        </View>

        <View className="mt-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[16px] font-extrabold text-gray-900">Groups</Text>
            <Text className="text-[13px] font-semibold text-gray-500">{totalMembers} items</Text>
          </View>

          {subgroupBlocks.length === 0 ? (
            <View className="rounded-[18px] border border-dashed border-gray-300 bg-white p-6">
              <Text className="text-center text-gray-500">No members found</Text>
            </View>
          ) : (
            <View className="gap-3">
              {subgroupBlocks.map((subgroup, subgroupIndex) => {
                return (
                  <View key={subgroup.id} className="rounded-[18px] border border-gray-200 bg-white p-4">
                    <View className="flex-row items-center gap-3">
                      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                        <Ionicons name="person-circle-outline" size={26} color="#111827" />
                      </View>

                      <View className="flex-1">
                        <View className="flex-row items-center justify-between gap-3">
                          <View className="flex-1">
                            <Text className="text-[13px] font-bold uppercase tracking-[1px] text-gray-500">
                              Leader
                            </Text>
                            <Text className="mt-0.5 text-[16px] font-extrabold text-gray-900">
                              {subgroup.leaderName || "Not set"}
                            </Text>
                          </View>

                          <Pressable
                            onPress={() => openAddMembersModal(subgroupIndex)}
                            className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                          >
                            <Ionicons name="add" size={22} color="#111827" />
                          </Pressable>
                        </View>
                      </View>
                    </View>

                    <View className="my-4 h-px bg-gray-200" />

                    <View className="flex-row flex-wrap justify-between gap-y-3">
                      {subgroup.members.length === 0 ? (
                        <Text className="text-gray-500">No members in this subgroup</Text>
                      ) : (
                        subgroup.members.map((member) => {
                          return (
                            <Pressable
                              key={`${subgroup.id}-${member.id}`}
                              onPress={() => openMember(member.id)}
                              className="w-[48.5%] rounded-[16px] border border-gray-200 bg-[#FAFAFA] p-3"
                            >
                              <View className="flex-row items-start gap-3">
                                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
                                  <Ionicons name="person" size={20} color="#6B7280" />
                                </View>

                                <View className="flex-1">
                                  <Text numberOfLines={2} className="text-[15px] font-extrabold text-gray-900">
                                    {member.name}
                                  </Text>

                                  <View className="mt-2 flex-row items-center gap-1.5">
                                    <Ionicons
                                      name={member.registered ? "checkmark-circle" : "alert-circle"}
                                      size={14}
                                      color={member.registered ? "#16A34A" : "#D97706"}
                                    />
                                    <Text
                                      className={`text-[12px] font-bold ${
                                        member.registered ? "text-emerald-600" : "text-amber-600"
                                      }`}
                                    >
                                      {member.registered ? "Registered" : "Unregistered"}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </Pressable>
                          );
                        })
                      )}
                    </View>

                    {subgroupIndex < subgroupBlocks.length - 1 ? <View className="mt-4 h-px bg-gray-200" /> : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showNewSubgroupModal} transparent animationType="fade" onRequestClose={closeNewSubgroupModal}>
        <View className="flex-1 items-center justify-center bg-black/45 px-5">
          <Pressable className="absolute inset-0" onPress={closeNewSubgroupModal} />
          <View className="w-full max-w-[520px] max-h-[86%] overflow-hidden rounded-[28px] bg-white shadow-lg">
            <View className="bg-gray-900 px-5 py-4">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                  <Ionicons name="people" size={22} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="text-[18px] font-extrabold text-white">Add Subgroup</Text>
                  <Text className="mt-0.5 text-[13px] font-semibold text-white/70">
                    {`Group ${indexToLetters(group.subgroups.length)}`}
                  </Text>
                </View>
                <Pressable
                  onPress={closeNewSubgroupModal}
                  className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
                >
                  <Ionicons name="close" size={22} color="white" />
                </Pressable>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="px-5 py-5 gap-4"
            >
              <View className="rounded-[20px] border border-gray-200 bg-gray-50 p-4">
                <Text className="text-[13px] font-extrabold text-gray-500">Leader</Text>
                <Pressable
                  onPress={() => openUserPicker("newSubgroupLeader")}
                  className="mt-2 flex-row items-center justify-between gap-2 rounded-[16px] border border-gray-200 bg-white px-4 py-3"
                >
                  <View className="flex-1">
                    <Text
                      className={`text-[15px] font-semibold ${
                        newSubgroupLeaderId ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {newSubgroupLeaderId ? userMap.get(newSubgroupLeaderId)?.name ?? "Select leader" : "Select leader"}
                    </Text>
                    {!!selectedLeader && (
                      <Text className="mt-1 text-[12px] font-semibold text-gray-500">
                        {selectedLeader.role || "No role"}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#6B7280" />
                </Pressable>
              </View>

              <View className="rounded-[20px] border border-gray-200 bg-white p-4">
                <Text className="text-[13px] font-extrabold text-gray-500">Members</Text>

                <Pressable
                  onPress={() => openUserPicker("newSubgroupMembers")}
                  className="mt-3 flex-row items-center justify-between gap-2 rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <Text
                    className={`flex-1 text-[15px] font-semibold ${
                      newSubgroupMemberIds.length > 0 ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {newSubgroupMemberIds.length > 0
                      ? `${newSubgroupMemberIds.length} selected`
                      : "Select members"}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#6B7280" />
                </Pressable>

                {newSubgroupMemberIds.length > 0 ? (
                  <View className="mt-3 gap-2">
                    {newSubgroupMemberIds.map((memberId) => (
                      <View
                        key={memberId}
                        className="flex-row items-center gap-3 rounded-[14px] border border-gray-200 bg-[#FAFAFA] px-3 py-2.5"
                      >
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-gray-200">
                          <Ionicons name="person" size={16} color="#6B7280" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-[14px] font-bold text-gray-900">
                            {userMap.get(memberId)?.name ?? "Unnamed"}
                          </Text>
                          <Text className="text-[12px] font-semibold text-gray-500">
                            {userMap.get(memberId)?.role || "No role"}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>

              <View className="flex-row items-center justify-end gap-2.5 pt-1">
                <Pressable onPress={closeNewSubgroupModal} className="rounded-[14px] bg-gray-200 px-4 py-3">
                  <Text className="font-extrabold text-gray-900">Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={createSubgroup}
                  disabled={savingAction}
                  className={`rounded-[14px] bg-gray-900 px-4 py-3 ${savingAction ? "opacity-75" : ""}`}
                >
                  <Text className="font-extrabold text-white">{savingAction ? "Saving..." : "Create"}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddMembersModal} transparent animationType="fade" onRequestClose={closeAddMembersModal}>
        <View className="flex-1 items-center justify-center bg-black/45 px-5">
          <Pressable className="absolute inset-0" onPress={closeAddMembersModal} />
          <View className="w-full max-w-[520px] max-h-[86%] overflow-hidden rounded-[28px] bg-white shadow-lg">
            <View className="bg-gray-900 px-5 py-4">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                  <Ionicons name="person-add" size={22} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="text-[18px] font-extrabold text-white">Add Members</Text>
                  <Text className="mt-0.5 text-[13px] font-semibold text-white/70">
                    {activeSubgroup?.name ?? "Subgroup"}
                  </Text>
                </View>
                <Pressable
                  onPress={closeAddMembersModal}
                  className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
                >
                  <Ionicons name="close" size={22} color="white" />
                </Pressable>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="px-5 py-5 gap-4"
            >
              <View className="rounded-[20px] border border-gray-200 bg-white p-4">
                <Text className="text-[13px] font-extrabold text-gray-500">Selected Members</Text>

                <Pressable
                  onPress={() => openUserPicker("existingSubgroupMembers", targetSubgroupIndex)}
                  className="mt-3 flex-row items-center justify-between gap-2 rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <Text
                    className={`flex-1 text-[15px] font-semibold ${
                      memberSelectionIds.length > 0 ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {memberSelectionIds.length > 0
                      ? `${memberSelectionIds.length} selected`
                      : "Select members"}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#6B7280" />
                </Pressable>

                {memberSelectionIds.length > 0 ? (
                  <View className="mt-3 gap-2">
                    {memberSelectionIds.map((memberId) => (
                      <View
                        key={memberId}
                        className="flex-row items-center gap-3 rounded-[14px] border border-gray-200 bg-[#FAFAFA] px-3 py-2.5"
                      >
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-gray-200">
                          <Ionicons name="person" size={16} color="#6B7280" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-[14px] font-bold text-gray-900">
                            {userMap.get(memberId)?.name ?? "Unnamed"}
                          </Text>
                          <Text className="text-[12px] font-semibold text-gray-500">
                            {userMap.get(memberId)?.role || "No role"}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>

              <View className="flex-row items-center justify-end gap-2.5 pt-1">
                <Pressable onPress={closeAddMembersModal} className="rounded-[14px] bg-gray-200 px-4 py-3">
                  <Text className="font-extrabold text-gray-900">Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={saveMembersToSubgroup}
                  disabled={savingAction}
                  className={`rounded-[14px] bg-gray-900 px-4 py-3 ${savingAction ? "opacity-75" : ""}`}
                >
                  <Text className="font-extrabold text-white">{savingAction ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showUserPickerModal} transparent animationType="fade" onRequestClose={closeUserPicker}>
        <View className="flex-1 items-center justify-center bg-black/45 px-5">
          <Pressable className="absolute inset-0" onPress={closeUserPicker} />
          <View className="w-full max-w-[560px] max-h-[88%] overflow-hidden rounded-[28px] bg-white shadow-lg">
            <View className="bg-gray-900 px-5 py-4">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                  <Ionicons name={pickerMode === "newSubgroupLeader" ? "person" : "people"} size={22} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="text-[18px] font-extrabold text-white">{selectedPickerTitle}</Text>
                  <Text className="mt-0.5 text-[13px] font-semibold text-white/70">
                    {pickerMode === "newSubgroupLeader"
                      ? "Choose exactly one leader"
                      : "Pick the people you want to include"}
                  </Text>
                </View>
                <Pressable onPress={closeUserPicker} className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <Ionicons name="close" size={22} color="white" />
                </Pressable>
              </View>
            </View>

            <View className="px-5 pt-5">
              <View className="mb-3 flex-row h-[52px] items-center gap-2.5 rounded-[16px] border border-gray-200 bg-white px-4">
                <Ionicons name="search" size={18} color="#6B7280" />
                <TextInput
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                  placeholder="Search users"
                  placeholderTextColor="#9CA3AF"
                  scrollEnabled={false}
                  multiline={false}
                  textAlignVertical="center"
                  className="flex-1 min-w-0 text-[15px] text-gray-900"
                  style={{
                    paddingVertical: 0,
                    includeFontPadding: false,
                  }}
                />
              </View>

              {pickerSelectedUsers.length > 0 && pickerMode !== "newSubgroupLeader" ? (
                <View className="mb-3 rounded-[16px] border border-blue-100 bg-blue-50 px-4 py-3">
                  <Text className="mb-2 text-[12px] font-extrabold uppercase tracking-[1px] text-blue-700">
                    Selected
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {pickerSelectedUsers.map((user) => (
                      <View
                        key={user.id}
                        className="flex-row items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-2"
                      >
                        <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                          <Ionicons name="person" size={13} color="#2563EB" />
                        </View>
                        <Text className="max-w-[180px] text-[12px] font-bold text-gray-900" numberOfLines={1}>
                          {user.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="px-5 pb-4 gap-2.5"
            >
              {filteredUsers.length === 0 ? (
                <Text className="py-5 text-center text-gray-500">No users found</Text>
              ) : (
                filteredUsers.map((user) => {
                  const active = pickerSelectedIds.includes(user.id);
                  const disabled = pickerBlockedIds.has(user.id) && !active;

                  return (
                    <Pressable
                      key={user.id}
                      onPress={() => {
                        if (disabled) return;
                        togglePickerUser(user.id);
                      }}
                      className={`flex-row items-center gap-3 rounded-[16px] border p-3 ${
                        disabled
                          ? "border-gray-100 bg-gray-50 opacity-50"
                          : active
                            ? "border-blue-200 bg-blue-50"
                            : "border-gray-200 bg-white"
                      }`}
                    >
                      <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-gray-100">
                        <Ionicons name="person" size={18} color="#9CA3AF" />
                      </View>

                      <View className="flex-1">
                        <Text className="text-[15px] font-extrabold text-gray-900">{user.name}</Text>
                        {!!user.joinedText && (
                          <Text className="mt-0.5 text-[13px] font-semibold text-gray-500">
                            {user.joinedText}
                          </Text>
                        )}
                      </View>

                      {pickerMode === "newSubgroupLeader" ? (
                        active ? (
                          <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                        ) : (
                          <Ionicons name="ellipse-outline" size={22} color="#9CA3AF" />
                        )
                      ) : active ? (
                        <Ionicons name="checkbox" size={22} color="#16A34A" />
                      ) : (
                        <Ionicons name="square-outline" size={22} color="#9CA3AF" />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <View className="flex-row items-center justify-end gap-2.5 px-5 pb-5 pt-2">
              <Pressable onPress={closeUserPicker} className="rounded-[14px] bg-gray-200 px-4 py-3">
                <Text className="font-extrabold text-gray-900">Close</Text>
              </Pressable>

              <Pressable onPress={confirmUserPicker} className="rounded-[14px] bg-gray-900 px-4 py-3">
                <Text className="font-extrabold text-white">{pickerMode === "newSubgroupLeader" ? "Select" : "Done"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}