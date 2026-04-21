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
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { db } from "../../lib/firebaseConfig";
import {
  NewSubgroupModal,
  AddMembersModal,
  UserPickerModal,
  EditGroupModal,
  AddDirectMembersModal,
  DeleteConfirmModal,
} from "./members-modal";

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

type MemberCard = {
  id: string;
  name: string;
  registered: boolean;
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
  members: MemberCard[];
  subgroups: SubgroupItem[];
};

type PickerMode = "newSubgroupLeader" | "newSubgroupMembers" | "existingSubgroupMembers" | "directMembers";

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

const getAnyId = (value: any) => {
  if (typeof value === "string") return value.trim();
  return String(value?.id ?? value?.memberId ?? value?.userId ?? value?.uid ?? "").trim();
};

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
  const [showAddDirectMembersModal, setShowAddDirectMembersModal] = useState(false);
  const [showUserPickerModal, setShowUserPickerModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);

  const [showSubgroupMenu, setShowSubgroupMenu] = useState(false);
  const [subgroupMenuTargetIndex, setSubgroupMenuTargetIndex] = useState<number | null>(null);
  const [subgroupMenuAnchor, setSubgroupMenuAnchor] = useState<{ left: number; top: number } | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const subgroupMenuRefs = useRef<Record<string, View | null>>({});

  const [newSubgroupLeaderId, setNewSubgroupLeaderId] = useState("");
  const [newSubgroupMemberIds, setNewSubgroupMemberIds] = useState<string[]>([]);
  const [directMemberIds, setDirectMemberIds] = useState<string[]>([]);
  const [targetSubgroupIndex, setTargetSubgroupIndex] = useState<number | null>(null);
  const [memberSelectionIds, setMemberSelectionIds] = useState<string[]>([]);
  const [editSubgroupLeaderId, setEditSubgroupLeaderId] = useState("");

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLeaderId, setEditLeaderId] = useState("");
  const [editPickerMode, setEditPickerMode] = useState(false);

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
      const collectionName = getCollectionName(groupKind);
      const groupRef = doc(db, collectionName, groupId);
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

      const rawSubgroups = Array.isArray(data?.subgroups) ? data.subgroups : [];
      const parsedSubgroups: SubgroupItem[] = rawSubgroups.map((subgroup: any, index: number) => {
        const leaderId = String(subgroup?.leaderId ?? "");
        const memberIds = normalizeIds(
          Array.isArray(subgroup?.memberIds) ? subgroup.memberIds.map((x: any) => String(x)) : []
        ).filter((id) => id !== leaderId && id !== String(data?.leaderId ?? ""));

        const storedMemberNames = Array.isArray(subgroup?.memberNames)
          ? subgroup.memberNames.map((x: any) => String(x)).filter(Boolean)
          : [];

        const memberNames = memberIds.map(
          (memberId: string, memberIndex: number) =>
            userLookup.get(memberId)?.name ?? storedMemberNames[memberIndex] ?? "Unnamed"
        );

        return {
          id: String(subgroup?.id ?? `${groupSnap.id}-${index}`),
          name: String(subgroup?.name ?? `Group ${indexToLetters(index)}`),
          leaderId,
          leaderName: String(subgroup?.leaderName ?? ""),
          leaderRole: String(subgroup?.leaderRole ?? ""),
          memberIds,
          memberNames,
        };
      });

      const subgroupMemberIds = normalizeIds(parsedSubgroups.flatMap((subgroup) => subgroup.memberIds ?? []));
      const subgroupLeaderIds = normalizeIds(parsedSubgroups.map((subgroup) => subgroup.leaderId ?? "").filter(Boolean));

      const rawMembers = Array.isArray(data?.members) ? data.members : [];
      const directMemberIds = normalizeIds(rawMembers.map((item: any) => getAnyId(item))).filter(
        (id) =>
          id &&
          id !== String(data?.leaderId ?? "") &&
          !subgroupMemberIds.includes(id) &&
          !subgroupLeaderIds.includes(id)
      );

      const directMembers: MemberCard[] = directMemberIds.map((memberId) => ({
        id: memberId,
        name: userLookup.get(memberId)?.name ?? "Unnamed",
        registered: Boolean(userLookup.get(memberId)),
      }));

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
        members: directMembers,
        subgroups: parsedSubgroups,
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
    return normalizeIds([
      ...group.members.map((member) => member.id),
      ...group.subgroups.flatMap((subgroup) => subgroup.memberIds ?? []),
    ]);
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

  const directMemberBlocks = useMemo(() => {
    if (!group) return [];
    return group.members.map((member) => ({
      ...member,
      name: userMap.get(member.id)?.name ?? member.name ?? "Unnamed",
      registered: Boolean(userMap.get(member.id)) || member.registered,
    }));
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

      group.members.forEach((member) => {
        if (member.id) ids.add(member.id);
      });

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
      pathname: "/admin/member",
      params: {
        memberId,
        groupId,
        groupKind,
        groupName: group?.name ?? groupNameParam,
      },
    });
  };

  const closeSubgroupMenu = () => {
    setShowSubgroupMenu(false);
    setSubgroupMenuTargetIndex(null);
    setSubgroupMenuAnchor(null);
  };

  const openSubgroupMenu = (subgroupIndex: number) => {
    if (!group) return;
    const subgroup = group.subgroups[subgroupIndex];
    if (!subgroup) return;

    setSubgroupMenuTargetIndex(subgroupIndex);

    const node = subgroupMenuRefs.current[subgroup.id];
    const menuWidth = 190;
    const menuHeight = 96;
    const margin = 12;
    const screen = Dimensions.get("window");

    if (node?.measureInWindow) {
      node.measureInWindow((x, y, width, height) => {
        let left = x + width - menuWidth;
        left = Math.max(margin, Math.min(left, screen.width - menuWidth - margin));

        let top = y + height + 8;
        if (top + menuHeight > screen.height - margin) {
          top = y - menuHeight - 8;
        }
        if (top < margin) top = margin;

        setSubgroupMenuAnchor({ left, top });
        setShowSubgroupMenu(true);
      });
      return;
    }

    setSubgroupMenuAnchor({ left: screen.width - menuWidth - margin, top: 150 });
    setShowSubgroupMenu(true);
  };

  const openCreateSubgroupModal = () => {
    setNewSubgroupLeaderId("");
    setNewSubgroupMemberIds([]);
    setShowNewSubgroupModal(true);
  };

  const openAddDirectMembersModal = () => {
    if (!group) return;
    setDirectMemberIds(group.members.map((member) => member.id));
    setShowAddDirectMembersModal(true);
  };

  const openAddMembersModal = (subgroupIndex: number) => {
    if (!group) return;
    setTargetSubgroupIndex(subgroupIndex);
    setEditSubgroupLeaderId(group.subgroups[subgroupIndex]?.leaderId ?? "");
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
    setEditSubgroupLeaderId("");
  };

  const closeAddDirectMembersModal = () => {
    setShowAddDirectMembersModal(false);
    setPickerSearch("");
    setPickerSelectedIds([]);
    setPickerTargetIndex(null);
  };

  const openEditSubgroupLeaderPicker = () => {
    setEditPickerMode(true);
    setPickerMode("newSubgroupLeader");
    setPickerSearch("");
    setPickerSelectedIds(editSubgroupLeaderId ? [editSubgroupLeaderId] : []);
    setPickerTargetIndex(targetSubgroupIndex);
    setShowUserPickerModal(true);
  };

  const confirmEditSubgroupLeader = () => {
    const chosenIds = normalizeIds(pickerSelectedIds);
    const chosenId = chosenIds[0] ?? "";
    if (!chosenId) return Alert.alert("Error", "Please select a leader");
    setEditSubgroupLeaderId(chosenId);
    setShowUserPickerModal(false);
    setPickerSearch("");
  };

  const closeUserPicker = () => {
    setShowUserPickerModal(false);
    setPickerSearch("");
    setPickerTargetIndex(null);
    if (editPickerMode) {
      setEditPickerMode(false);
    }
  };

  const openEditGroupModal = () => {
    if (!group) return;
    setEditName(group.name);
    setEditDescription(group.description ?? "");
    setEditLeaderId(group.leaderId ?? "");
    setShowEditGroupModal(true);
  };

  const closeEditGroupModal = () => {
    setShowEditGroupModal(false);
    setEditName("");
    setEditDescription("");
    setEditLeaderId("");
    setEditPickerMode(false);
  };

  const openEditLeaderPicker = () => {
    setEditPickerMode(true);
    setPickerMode("newSubgroupLeader");
    setPickerSearch("");
    setPickerSelectedIds(editLeaderId ? [editLeaderId] : []);
    setShowUserPickerModal(true);
  };

  const confirmEditLeaderPicker = () => {
    const chosenIds = normalizeIds(pickerSelectedIds);
    const chosenId = chosenIds[0] ?? "";
    if (!chosenId) return Alert.alert("Error", "Please select a leader");
    setEditLeaderId(chosenId);
    setShowUserPickerModal(false);
    setPickerSearch("");
    setEditPickerMode(false);
  };

  const saveEditGroup = async () => {
    if (!group) return;

    const name = editName.trim();
    const description = editDescription.trim();
    const leaderId = editLeaderId.trim();

    if (!name) {
      return Alert.alert("Error", "Please enter a group name");
    }

    if (!leaderId) {
      return Alert.alert("Error", "Please select a leader");
    }

    const leader = users.find((u) => u.id === leaderId);
    if (!leader) return Alert.alert("Error", "Selected leader not found");

    const groupRef = doc(db, getCollectionName(groupKind), group.id);

    setSavingAction(true);
    try {
      await updateDoc(groupRef, {
        name,
        description,
        leaderId: leader.id,
        leaderName: leader.name,
        leaderRole: leader.role,
        updatedAt: Timestamp.now(),
      });

      closeEditGroupModal();
      await loadData();
    } catch (error) {
      Alert.alert("Error", `Failed to update group\n${getErrorMessage(error)}`);
    } finally {
      setSavingAction(false);
    }
  };

  const openUserPicker = (mode: PickerMode, subgroupIndex: number | null = null) => {
    setEditPickerMode(false);
    setPickerMode(mode);
    setPickerTargetIndex(subgroupIndex);
    setPickerSearch("");

    if (mode === "newSubgroupLeader") {
      setPickerSelectedIds(newSubgroupLeaderId ? [newSubgroupLeaderId] : []);
    } else if (mode === "newSubgroupMembers") {
      setPickerSelectedIds(newSubgroupMemberIds);
    } else if (mode === "existingSubgroupMembers") {
      setPickerSelectedIds(memberSelectionIds);
    } else if (mode === "directMembers") {
      setPickerSelectedIds(directMemberIds);
    } else {
      setPickerSelectedIds([]);
    }

    setShowUserPickerModal(true);
  };

  const confirmUserPicker = () => {
    const chosenIds = normalizeIds(pickerSelectedIds);

    if (editPickerMode) {
      if (targetSubgroupIndex !== null) {
        confirmEditSubgroupLeader();
        return;
      } else {
        confirmEditLeaderPicker();
        return;
      }
    }

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
      return;
    }

    if (pickerMode === "directMembers") {
      if (chosenIds.length === 0) return Alert.alert("Error", "Please select members");
      const blocked = getBlockedIds(null);
      const allowed = chosenIds.filter((id) => !blocked.has(id) || directMemberIds.includes(id));
      setDirectMemberIds(allowed);
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
    (nextMembers: MemberCard[], subgroups: SubgroupItem[]) => {
      const nextAssignments = new Map<string, SubGroupAssignment>();

      nextMembers.forEach((member) => {
        nextAssignments.set(member.id, {
          groupId,
          groupName: group?.name ?? groupNameParam,
          subgroupId: "__members__",
          subgroupName: "Members",
          leaderId: group?.leaderId ?? "",
          leaderName: group?.leaderName ?? "",
          leaderRole: group?.leaderRole ?? "",
        });
      });

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
    [group, groupNameParam, groupId]
  );

  const saveAssignments = useCallback(
    async (
      nextMembers: MemberCard[],
      nextSubgroups: SubgroupItem[],
      previousMembers: MemberCard[],
      previousSubgroups: SubgroupItem[]
    ) => {
      const nextAssignments = getCurrentAssignments(nextMembers, nextSubgroups);
      const previousMemberIds = normalizeIds([
        ...previousMembers.map((member) => member.id),
        ...previousSubgroups.flatMap((subgroup) => subgroup.memberIds ?? []),
      ]);

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

  const persistGroupData = useCallback(
    async (nextMembers: MemberCard[], nextSubgroups: SubgroupItem[]) => {
      if (!group) return;

      const groupRef = doc(db, getCollectionName(groupKind), group.id);

      await updateDoc(groupRef, {
        members: nextMembers.map((member) => member.id),
        subgroups: nextSubgroups,
        updatedAt: Timestamp.now(),
      });

      await saveAssignments(nextMembers, nextSubgroups, group.members, group.subgroups);
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
      await persistGroupData(group.members, nextSubgroups);
      closeNewSubgroupModal();
      await loadData();
    } catch (error) {
      Alert.alert("Error", `Failed to add subgroup\n${getErrorMessage(error)}`);
    } finally {
      setSavingAction(false);
    }
  };

  const saveDirectMembers = async () => {
    if (!group) return;

    const blocked = getBlockedIds(null);
    const memberIds = normalizeIds(directMemberIds).filter(
      (id) => !blocked.has(id) || group.members.some((member) => member.id === id)
    );

    if (memberIds.length === 0) {
      return Alert.alert("Error", "Please select members");
    }

    const selectedMembers = memberIds
      .map((memberId) => users.find((u) => u.id === memberId))
      .filter((x): x is UserOption => Boolean(x));

    const nextMembers: MemberCard[] = selectedMembers.map((member) => ({
      id: member.id,
      name: member.name,
      registered: true,
    }));

    setSavingAction(true);
    try {
      await persistGroupData(nextMembers, group.subgroups);
      closeAddDirectMembersModal();
      await loadData();
    } catch (error) {
      Alert.alert("Error", `Failed to add members\n${getErrorMessage(error)}`);
    } finally {
      setSavingAction(false);
    }
  };

  const saveMembersToSubgroup = async () => {
    if (!group || targetSubgroupIndex === null) return;

    const target = group.subgroups[targetSubgroupIndex];
    if (!target) return;

    const newLeaderId = editSubgroupLeaderId.trim();
    if (!newLeaderId) {
      return Alert.alert("Error", "Please select a leader");
    }

    const leader = users.find((u) => u.id === newLeaderId);
    if (!leader) return Alert.alert("Error", "Selected leader not found");

    const blocked = getBlockedIds(targetSubgroupIndex);
    const selectedIds = normalizeIds(memberSelectionIds).filter((id) => !blocked.has(id) && id !== newLeaderId);

    const nextMemberIds = selectedIds.filter((id) => id !== group.leaderId);

    if (nextMemberIds.length === 0) {
      return Alert.alert("Error", "Please select members");
    }

    const nextSubgroup: SubgroupItem = {
      ...target,
      leaderId: leader.id,
      leaderName: leader.name,
      leaderRole: leader.role,
      memberIds: nextMemberIds,
      memberNames: nextMemberIds.map((memberId) => users.find((u) => u.id === memberId)?.name ?? "Unnamed"),
    };

    const nextSubgroups = group.subgroups.map((subgroup, index) =>
      index === targetSubgroupIndex ? nextSubgroup : subgroup
    );

    setSavingAction(true);
    try {
      await persistGroupData(group.members, nextSubgroups);
      closeAddMembersModal();
      await loadData();
    } catch (error) {
      Alert.alert("Error", `Failed to update members\n${getErrorMessage(error)}`);
    } finally {
      setSavingAction(false);
    }
  };

  const deleteSelectedSubgroup = async (index: number) => {
    console.log('deleteSelectedSubgroup called with index:', index);
    if (!group) {
      console.log('No group, returning');
      return;
    }
    const target = group.subgroups[index];
    if (!target) {
      console.log('No target subgroup at index', index);
      return;
    }

    console.log('Showing delete confirmation for:', target.name);
    setDeleteConfirmIndex(index);
    setShowDeleteConfirmModal(true);
  };

  const confirmDelete = async () => {
    if (deleteConfirmIndex === null || !group) return;
    const target = group.subgroups[deleteConfirmIndex];
    if (!target) return;

    setShowDeleteConfirmModal(false);
    console.log('Confirming delete for:', target.name);
    setSavingAction(true);
    try {
      const nextSubgroups = group.subgroups.filter((_, i) => i !== deleteConfirmIndex);
      console.log('Deleting subgroup, new count:', nextSubgroups.length);
      await persistGroupData(group.members, nextSubgroups);
      await loadData();
      console.log('Delete successful');
    } catch (error) {
      console.error('Delete failed:', error);
      Alert.alert("Error", `Failed to delete group\n${getErrorMessage(error)}`);
    } finally {
      setSavingAction(false);
      setDeleteConfirmIndex(null);
    }
  };

  const selectedPickerTitle =
    pickerMode === "newSubgroupLeader"
      ? "Select Subgroup Leader"
      : pickerMode === "newSubgroupMembers"
        ? "Select Subgroup Members"
        : pickerMode === "directMembers"
          ? "Select Members"
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
        <Text className="mt-3 text-center text-[16px] font-extrabold text-gray-900">Group not found</Text>
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
      <ScrollView className="flex-1" contentContainerClassName="px-5 pt-5 pb-[100px]" showsVerticalScrollIndicator={false}>
        <View className="mb-4 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-2xl font-extrabold text-gray-900">{group.name}</Text>
            {!!group.description && <Text className="mt-1 text-[14px] leading-5 text-gray-600">{group.description}</Text>}
          </View>
          <Pressable onPress={openEditGroupModal} className="h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <Ionicons name="pencil" size={22} color="#111827" />
          </Pressable>
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
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-gray-900">
              <Ionicons name="person-circle-outline" size={28} color="white" />
            </View>

            <View className="flex-1">
              <Text className="text-[13px] font-bold uppercase tracking-[1px] text-gray-500">Head Ministry</Text>
              <Text className="mt-0.5 text-[18px] font-extrabold text-gray-900">{leaderName}</Text>
            </View>
          </View>
        </View>

        <View className="mt-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[16px] font-extrabold text-gray-900">Members</Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-[13px] font-semibold text-gray-500">{directMemberBlocks.length} items</Text>
              <Pressable onPress={openAddDirectMembersModal} className="h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                <Ionicons name="add" size={22} color="#111827" />
              </Pressable>
            </View>
          </View>

          {directMemberBlocks.length > 0 ? (
            <View className="flex-row flex-wrap justify-between gap-y-3">
              {directMemberBlocks.map((member) => (
                <Pressable
                  key={member.id}
                  onPress={() => openMember(member.id)}
                  className="w-[48.5%] rounded-[16px] border border-gray-200 bg-white p-3"
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
                        <Text className={`text-[12px] font-bold ${member.registered ? "text-emerald-600" : "text-amber-600"}`}>
                          {member.registered ? "Registered" : "Unregistered"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View className="rounded-[18px] border border-dashed border-gray-300 bg-white p-6">
              <Text className="text-center text-gray-500">No members found</Text>
            </View>
          )}
        </View>

        <View className="mt-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[16px] font-extrabold text-gray-900">Groups</Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-[13px] font-semibold text-gray-500">{subgroupBlocks.length} items</Text>
              <Pressable onPress={openCreateSubgroupModal} className="h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                <Ionicons name="add" size={22} color="#111827" />
              </Pressable>
            </View>
          </View>

          {subgroupBlocks.length === 0 ? (
            <View className="rounded-[18px] border border-dashed border-gray-300 bg-white p-6">
              <Text className="text-center text-gray-500">No groups found</Text>
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
                            <Text className="text-[13px] font-bold uppercase tracking-[1px] text-gray-500">Leader</Text>
                            <Text className="mt-0.5 text-[16px] font-extrabold text-gray-900">
                              {subgroup.leaderName || "Not set"}
                            </Text>
                          </View>

                          <View ref={(node) => { subgroupMenuRefs.current[subgroup.id] = node; }}>
                            <Pressable
                              onPress={() => openSubgroupMenu(subgroupIndex)}
                              className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                            >
                              <Ionicons name="ellipsis-horizontal" size={22} color="#111827" />
                            </Pressable>
                          </View>
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
                                    <Text className={`text-[12px] font-bold ${member.registered ? "text-emerald-600" : "text-amber-600"}`}>
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

      <Modal visible={showSubgroupMenu} transparent animationType="fade" onRequestClose={closeSubgroupMenu}>
        <Pressable onPress={closeSubgroupMenu} className="flex-1 bg-black/10" />
        {subgroupMenuAnchor ? (
          <View
            className="absolute z-[9999] w-[190px] overflow-hidden rounded-[18px] border border-gray-200 bg-white shadow-xl"
            style={{ left: subgroupMenuAnchor.left, top: subgroupMenuAnchor.top }}
            onStartShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
          >
            <Pressable
              onPress={() => {
                const index = subgroupMenuTargetIndex;
                closeSubgroupMenu();
                if (index !== null) openAddMembersModal(index);
              }}
              className="flex-row items-center gap-2.5 px-4 py-3"
            >
              <Ionicons name="create-outline" size={18} color="#111827" />
              <Text className="text-[14px] font-semibold text-gray-900">Edit Group</Text>
            </Pressable>

            <View className="h-px bg-gray-100" />

            <Pressable
              onPress={() => {
                console.log('Delete button pressed, subgroupMenuTargetIndex:', subgroupMenuTargetIndex);
                const index = subgroupMenuTargetIndex;
                closeSubgroupMenu();
                if (index !== null) {
                  console.log('Calling deleteSelectedSubgroup with index:', index);
                  deleteSelectedSubgroup(index);
                } else {
                  console.log('Index is null, not calling delete');
                }
              }}
              className="flex-row items-center gap-2.5 px-4 py-3"
            >
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
              <Text className="text-[14px] font-semibold text-red-600">Delete Group</Text>
            </Pressable>
          </View>
        ) : null}
      </Modal>

      <DeleteConfirmModal
        visible={showDeleteConfirmModal}
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={confirmDelete}
        subgroupName={deleteConfirmIndex !== null ? group?.subgroups[deleteConfirmIndex]?.name : undefined}
        savingAction={savingAction}
      />

      <NewSubgroupModal
        visible={showNewSubgroupModal}
        onClose={closeNewSubgroupModal}
        onCreate={createSubgroup}
        group={group}
        newSubgroupLeaderId={newSubgroupLeaderId}
        newSubgroupMemberIds={newSubgroupMemberIds}
        userMap={userMap}
        onOpenUserPicker={openUserPicker}
        selectedLeader={selectedLeader}
        savingAction={savingAction}
        indexToLetters={indexToLetters}
      />

      <AddDirectMembersModal
        visible={showAddDirectMembersModal}
        onClose={closeAddDirectMembersModal}
        onSave={saveDirectMembers}
        group={group}
        directMemberIds={directMemberIds}
        userMap={userMap}
        onOpenUserPicker={openUserPicker}
        savingAction={savingAction}
      />

      <AddMembersModal
        visible={showAddMembersModal}
        onClose={closeAddMembersModal}
        onSave={saveMembersToSubgroup}
        activeSubgroup={activeSubgroup}
        memberSelectionIds={memberSelectionIds}
        userMap={userMap}
        onOpenUserPicker={openUserPicker}
        savingAction={savingAction}
        editSubgroupLeaderId={editSubgroupLeaderId}
        onEditLeaderClick={openEditSubgroupLeaderPicker}
      />

      <EditGroupModal
        visible={showEditGroupModal}
        onClose={closeEditGroupModal}
        onSave={saveEditGroup}
        group={group}
        editName={editName}
        onEditNameChange={setEditName}
        editDescription={editDescription}
        onEditDescriptionChange={setEditDescription}
        editLeaderId={editLeaderId}
        userMap={userMap}
        onOpenUserPicker={openEditLeaderPicker}
        selectedEditLeader={editLeaderId ? userMap.get(editLeaderId) : null}
        savingAction={savingAction}
      />

      <UserPickerModal
        visible={showUserPickerModal}
        onClose={closeUserPicker}
        onConfirm={confirmUserPicker}
        pickerMode={pickerMode}
        pickerSearch={pickerSearch}
        onPickerSearchChange={setPickerSearch}
        filteredUsers={filteredUsers}
        pickerSelectedIds={pickerSelectedIds}
        pickerBlockedIds={pickerBlockedIds}
        onToggleUser={togglePickerUser}
        selectedPickerTitle={selectedPickerTitle}
        pickerSelectedUsers={pickerSelectedUsers}
      />
    </View>
  );
}