import { Ionicons } from "@expo/vector-icons";
import { Timestamp, doc, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { db } from "../../lib/firebaseConfig";

type UserOption = {
  id: string;
  name: string;
  role: string;
  joinedGroups: string[];
  joinedText: string;
};

type MemberCard = {
  id: string;
  name: string;
  registered: boolean;
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
  createdAt?: any;
  isActive?: boolean;
  kind?: "ministry" | "coreGroup";
  members: MemberCard[];
  subgroups: SubgroupItem[];
};

type SubGroupAssignment = {
  groupId: string;
  groupName: string;
  subgroupId: string;
  subgroupName: string;
  leaderId: string;
  leaderName: string;
  leaderRole: string;
};

type PickerMode = "newSubgroupLeader" | "newSubgroupMembers" | "existingSubgroupMembers" | "directMembers";

const normalizeIds = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));

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

const getCollectionName = () => "ministries";

interface UseModalFunctionsProps {
  group: GroupItem | null;
  users: UserOption[];
  loadData: () => Promise<void>;
  getBlockedIds: (excludeSubgroupIndex: number | null) => Set<string>;
  groupId: string;
  groupNameParam: string;
  setSavingAction: (saving: boolean) => void;
}

export function useModalFunctions({
  group,
  users,
  loadData,
  getBlockedIds,
  groupId,
  groupNameParam,
  setSavingAction,
}: UseModalFunctionsProps) {
  const [showNewSubgroupModal, setShowNewSubgroupModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showUserPickerModal, setShowUserPickerModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  const [newSubgroupLeaderId, setNewSubgroupLeaderId] = useState("");
  const [newSubgroupMemberIds, setNewSubgroupMemberIds] = useState<string[]>([]);
  const [newSubgroupDraftId, setNewSubgroupDraftId] = useState("");

  const [directMemberIds, setDirectMemberIds] = useState<string[]>([]);
  const [targetSubgroupIndex, setTargetSubgroupIndex] = useState<number | null>(null);
  const [memberSelectionIds, setMemberSelectionIds] = useState<string[]>([]);
  const [editSubgroupLeaderId, setEditSubgroupLeaderId] = useState("");
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLeaderId, setEditLeaderId] = useState("");

  const [pickerMode, setPickerMode] = useState<PickerMode>("newSubgroupLeader");
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);
  const [editPickerMode, setEditPickerMode] = useState(false);

  const getBlockedIdsForSubgroupId = useCallback(
    (excludeSubgroupId: string | null) => {
      const blocked = new Set<string>();

      if (!group) return blocked;

      if (group.leaderId) blocked.add(group.leaderId);

      group.subgroups.forEach((subgroup) => {
        if (excludeSubgroupId && subgroup.id === excludeSubgroupId) return;

        if (subgroup.leaderId) blocked.add(subgroup.leaderId);
        subgroup.memberIds.forEach((id) => blocked.add(id));
      });

      return blocked;
    },
    [group]
  );

  const getPickerBlockedIds = useCallback(
    (mode: PickerMode, subgroupIndex: number | null = null) => {
      const blocked = new Set<string>();

      if (!group) return blocked;

      if (mode === "newSubgroupMembers") {
        if (group.leaderId) blocked.add(group.leaderId);
        if (newSubgroupLeaderId) blocked.add(newSubgroupLeaderId);
        if (newSubgroupDraftId) {
          const subgroupBlocked = getBlockedIdsForSubgroupId(newSubgroupDraftId);
          subgroupBlocked.forEach((id) => blocked.add(id));
        }
      }

      if (mode === "existingSubgroupMembers") {
        if (group.leaderId) blocked.add(group.leaderId);
        if (editSubgroupLeaderId) blocked.add(editSubgroupLeaderId);

        const subgroupBlocked = getBlockedIds(subgroupIndex);
        subgroupBlocked.forEach((id) => blocked.add(id));
      }

      if (mode === "directMembers") {
        if (group.leaderId) blocked.add(group.leaderId);
        if (editLeaderId) blocked.add(editLeaderId);
      }

      return blocked;
    },
    [
      group,
      getBlockedIds,
      getBlockedIdsForSubgroupId,
      newSubgroupLeaderId,
      newSubgroupDraftId,
      editLeaderId,
      editSubgroupLeaderId,
    ]
  );

  const filterSelectableIds = useCallback(
    (ids: string[], mode: PickerMode, subgroupIndex: number | null = null) => {
      const blocked = getPickerBlockedIds(mode, subgroupIndex);
      return normalizeIds(ids).filter((id) => !blocked.has(id));
    },
    [getPickerBlockedIds]
  );

  const pickerBlockedIds = useMemo(
    () => getPickerBlockedIds(pickerMode, pickerTargetIndex),
    [getPickerBlockedIds, pickerMode, pickerTargetIndex]
  );

  const openCreateSubgroupModal = useCallback(() => {
    setNewSubgroupDraftId(makeLocalId());
    setNewSubgroupLeaderId("");
    setNewSubgroupMemberIds([]);
    setShowNewSubgroupModal(true);
  }, []);

  const closeNewSubgroupModal = useCallback(() => {
    setShowNewSubgroupModal(false);
    setPickerSearch("");
    setPickerSelectedIds([]);
    setPickerTargetIndex(null);
    setNewSubgroupDraftId("");
    setNewSubgroupLeaderId("");
    setNewSubgroupMemberIds([]);
  }, []);

  const openAddMembersModal = useCallback(
    (subgroupIndex: number) => {
      if (!group) return;
      setTargetSubgroupIndex(subgroupIndex);
      setEditSubgroupLeaderId(group.subgroups[subgroupIndex]?.leaderId ?? "");
      setMemberSelectionIds(normalizeIds(group.subgroups[subgroupIndex]?.memberIds ?? []));
      setShowAddMembersModal(true);
    },
    [group]
  );

  const closeAddMembersModal = useCallback(() => {
    setShowAddMembersModal(false);
    setPickerSearch("");
    setPickerSelectedIds([]);
    setPickerTargetIndex(null);
    setTargetSubgroupIndex(null);
    setEditSubgroupLeaderId("");
    setMemberSelectionIds([]);
  }, []);

  const openEditGroupModal = useCallback(() => {
    if (!group) return;
    setEditName(group.name);
    setEditDescription(group.description ?? "");
    setEditLeaderId(group.leaderId ?? "");
    setShowEditGroupModal(true);
  }, [group]);

  const closeEditGroupModal = useCallback(() => {
    setShowEditGroupModal(false);
    setEditName("");
    setEditDescription("");
    setEditLeaderId("");
    setEditPickerMode(false);
  }, []);

  const closeUserPicker = useCallback(() => {
    setShowUserPickerModal(false);
    setPickerSearch("");
    setPickerTargetIndex(null);
    if (editPickerMode) {
      setEditPickerMode(false);
    }
  }, [editPickerMode]);

  const openUserPicker = useCallback(
    (mode: PickerMode, subgroupIndex: number | null = null) => {
      setEditPickerMode(false);
      setPickerMode(mode);
      setPickerTargetIndex(subgroupIndex);
      setPickerSearch("");

      if (mode === "newSubgroupLeader") {
        setPickerSelectedIds(newSubgroupLeaderId ? [newSubgroupLeaderId] : []);
      } else if (mode === "newSubgroupMembers") {
        setPickerSelectedIds(filterSelectableIds(newSubgroupMemberIds, mode, subgroupIndex));
      } else if (mode === "existingSubgroupMembers") {
        setPickerSelectedIds(filterSelectableIds(memberSelectionIds, mode, subgroupIndex));
      } else if (mode === "directMembers") {
        setPickerSelectedIds(filterSelectableIds(directMemberIds, mode, subgroupIndex));
      } else {
        setPickerSelectedIds([]);
      }

      setShowUserPickerModal(true);
    },
    [newSubgroupLeaderId, newSubgroupMemberIds, memberSelectionIds, directMemberIds, filterSelectableIds]
  );

  const togglePickerUser = useCallback(
    (userId: string) => {
      const blocked = getPickerBlockedIds(pickerMode, pickerTargetIndex);
      if (blocked.has(userId)) return;

      setPickerSelectedIds((prev) => {
        const isSelected = prev.includes(userId);
        if (isSelected) {
          return prev.filter((id) => id !== userId);
        }
        return [...prev, userId];
      });
    },
    [getPickerBlockedIds, pickerMode, pickerTargetIndex]
  );

  const persistGroupData = useCallback(
    async (nextMembers: MemberCard[], nextSubgroups: SubgroupItem[]) => {
      if (!group) return;

      const groupRef = doc(db, getCollectionName(), group.id);

      await updateDoc(groupRef, {
        members: nextMembers.map((member) => member.id),
        subgroups: nextSubgroups,
        updatedAt: Timestamp.now(),
      });
    },
    [group]
  );

  const autoSaveNewSubgroup = useCallback(
    async (nextLeaderId: string, nextMemberIds: string[]) => {
      if (!group || !newSubgroupDraftId) return;

      const leaderId = nextLeaderId.trim();
      const memberIds = normalizeIds(nextMemberIds);

      if (!leaderId || memberIds.length === 0) return;

      if (group.leaderId && leaderId === group.leaderId) {
        return Alert.alert("Error", "Head ministry leader cannot be used as subgroup leader");
      }

      const leader = users.find((u) => u.id === leaderId);
      if (!leader) return Alert.alert("Error", "Selected leader not found");

      const blocked = getBlockedIdsForSubgroupId(newSubgroupDraftId);
      if (blocked.has(leaderId)) {
        return Alert.alert("Error", "Selected leader is already used in this group");
      }

      const validMemberIds = memberIds.filter((id) => !blocked.has(id) && id !== leaderId && id !== group.leaderId);

      if (validMemberIds.length === 0) {
        return Alert.alert("Error", "Please select members");
      }

      if (validMemberIds.includes(leaderId)) {
        return Alert.alert("Error", "Leader cannot also be a member of the same subgroup");
      }

      const selectedMembers = validMemberIds
        .map((memberId) => users.find((u) => u.id === memberId))
        .filter((x): x is UserOption => Boolean(x));

      const existingIndex = group.subgroups.findIndex((subgroup) => subgroup.id === newSubgroupDraftId);

      const subgroupPayload: SubgroupItem = {
        id: newSubgroupDraftId,
        name: existingIndex >= 0 ? group.subgroups[existingIndex].name : `Group ${indexToLetters(group.subgroups.length)}`,
        leaderId: leader.id,
        leaderName: leader.name,
        leaderRole: leader.role,
        memberIds: validMemberIds,
        memberNames: selectedMembers.map((member) => member.name),
      };

      const nextSubgroups =
        existingIndex >= 0
          ? group.subgroups.map((subgroup, index) => (index === existingIndex ? subgroupPayload : subgroup))
          : [...group.subgroups, subgroupPayload];

      setSavingAction(true);
      try {
        await persistGroupData(group.members, nextSubgroups);
        await loadData();
      } catch (error) {
        Alert.alert("Error", `Failed to auto-save subgroup\n${getErrorMessage(error)}`);
      } finally {
        setSavingAction(false);
      }
    },
    [
      group,
      newSubgroupDraftId,
      users,
      getBlockedIdsForSubgroupId,
      persistGroupData,
      loadData,
      setSavingAction,
    ]
  );

  const autoSaveExistingSubgroup = useCallback(
    async (subgroupIndex: number, nextLeaderId: string, nextMemberIds: string[]) => {
      if (!group) return;

      const target = group.subgroups[subgroupIndex];
      if (!target) return;

      const leaderId = nextLeaderId.trim();
      const memberIds = normalizeIds(nextMemberIds);

      if (!leaderId || memberIds.length === 0) return;

      if (group.leaderId && leaderId === group.leaderId) {
        return Alert.alert("Error", "Head ministry leader cannot be used as subgroup leader");
      }

      const leader = users.find((u) => u.id === leaderId);
      if (!leader) return Alert.alert("Error", "Selected leader not found");

      const blocked = getBlockedIds(subgroupIndex);
      const selectedIds = memberIds.filter((id) => !blocked.has(id) && id !== leaderId && id !== group.leaderId);

      if (selectedIds.length === 0) {
        return Alert.alert("Error", "Please select members");
      }

      const nextSubgroup: SubgroupItem = {
        ...target,
        leaderId: leader.id,
        leaderName: leader.name,
        leaderRole: leader.role,
        memberIds: selectedIds,
        memberNames: selectedIds.map((memberId) => users.find((u) => u.id === memberId)?.name ?? "Unnamed"),
      };

      const nextSubgroups = group.subgroups.map((subgroup, index) =>
        index === subgroupIndex ? nextSubgroup : subgroup
      );

      setSavingAction(true);
      try {
        await persistGroupData(group.members, nextSubgroups);
        await loadData();
      } catch (error) {
        Alert.alert("Error", `Failed to auto-save members\n${getErrorMessage(error)}`);
      } finally {
        setSavingAction(false);
      }
    },
    [group, users, getBlockedIds, persistGroupData, loadData, setSavingAction]
  );

  const confirmUserPicker = useCallback(() => {
    const chosenIds = normalizeIds(pickerSelectedIds);

    if (editPickerMode) {
      if (targetSubgroupIndex !== null) {
        const chosenId = chosenIds[0] ?? "";
        if (!chosenId) return Alert.alert("Error", "Please select a leader");
        if (group?.leaderId && chosenId === group.leaderId) {
          return Alert.alert("Error", "Head ministry leader cannot be used as subgroup leader");
        }
        setEditSubgroupLeaderId(chosenId);
        setShowUserPickerModal(false);
        setPickerSearch("");
        return;
      } else {
        const chosenId = chosenIds[0] ?? "";
        if (!chosenId) return Alert.alert("Error", "Please select a leader");
        if (group?.leaderId && chosenId === group.leaderId) {
          return Alert.alert("Error", "Head ministry leader cannot be selected again");
        }
        setEditLeaderId(chosenId);
        setShowUserPickerModal(false);
        setPickerSearch("");
        setEditPickerMode(false);
        return;
      }
    }

    if (pickerMode === "newSubgroupLeader") {
      const chosenId = chosenIds[0] ?? "";
      if (!chosenId) return Alert.alert("Error", "Please select a subgroup leader");
      if (group?.leaderId && chosenId === group.leaderId) {
        return Alert.alert("Error", "Head ministry leader cannot be used as subgroup leader");
      }
      setNewSubgroupLeaderId(chosenId);
      setShowUserPickerModal(false);
      setPickerSearch("");
      if (newSubgroupMemberIds.length > 0) {
        void autoSaveNewSubgroup(chosenId, newSubgroupMemberIds);
      }
      return;
    }

    if (pickerMode === "newSubgroupMembers") {
      const blocked = getPickerBlockedIds(pickerMode, null);
      const allowed = chosenIds.filter((id) => !blocked.has(id));
      if (allowed.length === 0) return Alert.alert("Error", "Please select members");
      setNewSubgroupMemberIds(allowed);
      setShowUserPickerModal(false);
      setPickerSearch("");
      if (newSubgroupLeaderId) {
        void autoSaveNewSubgroup(newSubgroupLeaderId, allowed);
      }
      return;
    }

    if (pickerMode === "existingSubgroupMembers") {
      if (targetSubgroupIndex === null) return;
      const blocked = getPickerBlockedIds(pickerMode, targetSubgroupIndex);
      const allowed = chosenIds.filter((id) => !blocked.has(id));
      if (allowed.length === 0) return Alert.alert("Error", "Please select members");
      setMemberSelectionIds(allowed);
      setShowUserPickerModal(false);
      setPickerSearch("");
      if (editSubgroupLeaderId) {
        void autoSaveExistingSubgroup(targetSubgroupIndex, editSubgroupLeaderId, allowed);
      }
      return;
    }

    if (pickerMode === "directMembers") {
      const blocked = getPickerBlockedIds(pickerMode, null);
      const allowed = chosenIds.filter((id) => !blocked.has(id));
      if (allowed.length === 0) return Alert.alert("Error", "Please select members");
      setDirectMemberIds(allowed);
      closeUserPicker();
    }
  }, [
    pickerSelectedIds,
    editPickerMode,
    targetSubgroupIndex,
    pickerMode,
    group,
    getPickerBlockedIds,
    closeUserPicker,
    newSubgroupMemberIds,
    newSubgroupLeaderId,
    editSubgroupLeaderId,
    autoSaveNewSubgroup,
    autoSaveExistingSubgroup,
  ]);

  const openEditSubgroupLeaderPicker = useCallback(() => {
    setEditPickerMode(true);
    setPickerMode("newSubgroupLeader");
    setPickerSearch("");
    setPickerSelectedIds(editSubgroupLeaderId ? [editSubgroupLeaderId] : []);
    setPickerTargetIndex(targetSubgroupIndex);
    setShowUserPickerModal(true);
  }, [editSubgroupLeaderId, targetSubgroupIndex]);

  const openEditLeaderPicker = useCallback(() => {
    setEditPickerMode(true);
    setPickerMode("newSubgroupLeader");
    setPickerSearch("");
    setPickerSelectedIds(editLeaderId ? [editLeaderId] : []);
    setShowUserPickerModal(true);
  }, [editLeaderId]);

  const getCurrentAssignments = useCallback(
    (nextMembers: MemberCard[], nextSubgroups: SubgroupItem[]) => {
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

      nextSubgroups.forEach((subgroup) => {
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

  const createSubgroup = useCallback(async () => {
    if (!group) return;

    const leaderId = newSubgroupLeaderId.trim();
    const memberIds = normalizeIds(newSubgroupMemberIds);

    if (!leaderId) {
      return Alert.alert("Error", "Please select a subgroup leader");
    }

    if (group.leaderId && leaderId === group.leaderId) {
      return Alert.alert("Error", "Head ministry leader cannot be used as subgroup leader");
    }

    if (memberIds.length === 0) {
      return Alert.alert("Error", "Please select members");
    }

    const blocked = getBlockedIdsForSubgroupId(newSubgroupDraftId);

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

    const existingIndex = group.subgroups.findIndex((subgroup) => subgroup.id === newSubgroupDraftId);

    const newSubgroup: SubgroupItem = {
      id: newSubgroupDraftId || makeLocalId(),
      name: existingIndex >= 0 ? group.subgroups[existingIndex].name : `Group ${indexToLetters(group.subgroups.length)}`,
      leaderId: leader.id,
      leaderName: leader.name,
      leaderRole: leader.role,
      memberIds,
      memberNames: selectedMembers.map((member) => member.name),
    };

    const nextSubgroups =
      existingIndex >= 0
        ? group.subgroups.map((subgroup, index) => (index === existingIndex ? newSubgroup : subgroup))
        : [...group.subgroups, newSubgroup];

    setSavingAction(true);
    try {
      await persistGroupData(group.members, nextSubgroups);
      await loadData();
    } catch (error) {
      Alert.alert("Error", `Failed to add subgroup\n${getErrorMessage(error)}`);
    } finally {
      setSavingAction(false);
    }
  }, [
    group,
    newSubgroupLeaderId,
    newSubgroupMemberIds,
    newSubgroupDraftId,
    users,
    getBlockedIdsForSubgroupId,
    persistGroupData,
    loadData,
    setSavingAction,
  ]);

  const saveMembersToSubgroup = useCallback(async () => {
    if (!group || targetSubgroupIndex === null) return;

    const target = group.subgroups[targetSubgroupIndex];
    if (!target) return;

    const newLeaderId = editSubgroupLeaderId.trim();
    if (!newLeaderId) {
      return Alert.alert("Error", "Please select a leader");
    }

    if (group.leaderId && newLeaderId === group.leaderId) {
      return Alert.alert("Error", "Head ministry leader cannot be used as subgroup leader");
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
      await loadData();
    } catch (error) {
      Alert.alert("Error", `Failed to update members\n${getErrorMessage(error)}`);
    } finally {
      setSavingAction(false);
    }
  }, [
    group,
    targetSubgroupIndex,
    editSubgroupLeaderId,
    memberSelectionIds,
    users,
    getBlockedIds,
    persistGroupData,
    loadData,
    setSavingAction,
  ]);

  const saveEditGroup = useCallback(async () => {
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

    const groupRef = doc(db, getCollectionName(), group.id);

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
  }, [group, editName, editDescription, editLeaderId, users, closeEditGroupModal, loadData, setSavingAction]);

  const deleteSelectedSubgroup = useCallback(
    (index: number) => {
      if (!group) return;
      const target = group.subgroups[index];
      if (!target) return;

      setDeleteConfirmIndex(index);
      setShowDeleteConfirmModal(true);
    },
    [group]
  );

  const confirmDelete = useCallback(async () => {
    if (deleteConfirmIndex === null || !group) return;
    const target = group.subgroups[deleteConfirmIndex];
    if (!target) return;

    setShowDeleteConfirmModal(false);
    setSavingAction(true);
    try {
      const nextSubgroups = group.subgroups.filter((_, i) => i !== deleteConfirmIndex);
      await persistGroupData(group.members, nextSubgroups);
      await loadData();
    } catch (error) {
      Alert.alert("Error", `Failed to delete group\n${getErrorMessage(error)}`);
    } finally {
      setSavingAction(false);
      setDeleteConfirmIndex(null);
    }
  }, [deleteConfirmIndex, group, persistGroupData, loadData, setSavingAction]);

  return {
    showNewSubgroupModal,
    setShowNewSubgroupModal,
    showAddMembersModal,
    setShowAddMembersModal,
    showUserPickerModal,
    setShowUserPickerModal,
    showEditGroupModal,
    setShowEditGroupModal,
    showDeleteConfirmModal,
    setShowDeleteConfirmModal,

    newSubgroupLeaderId,
    setNewSubgroupLeaderId,
    newSubgroupMemberIds,
    setNewSubgroupMemberIds,
    newSubgroupDraftId,
    setNewSubgroupDraftId,
    targetSubgroupIndex,
    setTargetSubgroupIndex,
    memberSelectionIds,
    setMemberSelectionIds,
    editSubgroupLeaderId,
    setEditSubgroupLeaderId,
    deleteConfirmIndex,
    setDeleteConfirmIndex,

    editName,
    setEditName,
    editDescription,
    setEditDescription,
    editLeaderId,
    setEditLeaderId,

    pickerMode,
    setPickerMode,
    pickerTargetIndex,
    setPickerTargetIndex,
    pickerSearch,
    setPickerSearch,
    pickerSelectedIds,
    setPickerSelectedIds,
    editPickerMode,
    setEditPickerMode,
    pickerBlockedIds,

    openCreateSubgroupModal,
    closeNewSubgroupModal,
    openAddMembersModal,
    closeAddMembersModal,
    openEditGroupModal,
    closeEditGroupModal,
    openUserPicker,
    closeUserPicker,
    togglePickerUser,
    confirmUserPicker,
    openEditSubgroupLeaderPicker,
    openEditLeaderPicker,

    createSubgroup,
    saveMembersToSubgroup,
    saveEditGroup,
    deleteSelectedSubgroup,
    confirmDelete,
  };
}

type NewSubgroupModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreate?: () => Promise<void>;
  group: GroupItem | null;
  newSubgroupLeaderId: string;
  newSubgroupMemberIds: string[];
  userMap: Map<string, UserOption>;
  onOpenUserPicker: (mode: PickerMode) => void;
  selectedLeader: UserOption | null | undefined;
  savingAction?: boolean;
  indexToLetters: (index: number) => string;
};

export function NewSubgroupModal({
  visible,
  onClose,
  group,
  newSubgroupLeaderId,
  newSubgroupMemberIds,
  userMap,
  onOpenUserPicker,
  selectedLeader,
  indexToLetters,
}: NewSubgroupModalProps) {
  if (!group) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/45 px-5">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="w-full max-w-[520px] max-h-[86%] overflow-hidden rounded-[28px] bg-white shadow-lg z-[10000] elevation-20">
          <View className="bg-gray-900 px-5 py-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Ionicons name="people" size={22} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-[18px] font-extrabold text-white">Add Group</Text>
                <Text className="mt-0.5 text-[13px] font-semibold text-white/70">
                  {`Group ${indexToLetters(group.subgroups.length)}`}
                </Text>
              </View>
              <Pressable onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
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
                onPress={() => onOpenUserPicker("newSubgroupLeader")}
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
                onPress={() => onOpenUserPicker("newSubgroupMembers")}
                className="mt-3 flex-row items-center justify-between gap-2 rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <Text
                  className={`flex-1 text-[15px] font-semibold ${
                    newSubgroupMemberIds.length > 0 ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  {newSubgroupMemberIds.length > 0 ? `${newSubgroupMemberIds.length} selected` : "Select members"}
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

            <View className="rounded-[16px] border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
              <Text className="text-[12px] font-semibold text-gray-500">
                Selections save automatically after both leader and members are chosen.
              </Text>
            </View>

            <View className="flex-row items-center justify-end pt-1">
              <Pressable onPress={onClose} className="rounded-[14px] bg-gray-200 px-4 py-3">
                <Text className="font-extrabold text-gray-900">Close</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type AddMembersModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: () => Promise<void>;
  activeSubgroup: SubgroupItem | null;
  memberSelectionIds: string[];
  userMap: Map<string, UserOption>;
  onOpenUserPicker: (mode: PickerMode, subgroupIndex?: number | null) => void;
  savingAction?: boolean;
  editSubgroupLeaderId: string;
  onEditLeaderClick: () => void;
};

export function AddMembersModal({
  visible,
  onClose,
  activeSubgroup,
  memberSelectionIds,
  userMap,
  onOpenUserPicker,
  editSubgroupLeaderId,
  onEditLeaderClick,
}: AddMembersModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/45 px-5">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="w-full max-w-[520px] max-h-[86%] overflow-hidden rounded-[28px] bg-white shadow-lg z-[10000] elevation-20">
          <View className="bg-gray-900 px-5 py-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Ionicons name="person-add" size={22} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-[18px] font-extrabold text-white">Manage Group</Text>
                <Text className="mt-0.5 text-[13px] font-semibold text-white/70">
                  {activeSubgroup?.name ?? "Subgroup"}
                </Text>
              </View>
              <Pressable onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
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
                onPress={onEditLeaderClick}
                className="mt-2 flex-row items-center justify-between gap-2 rounded-[16px] border border-gray-200 bg-white px-4 py-3"
              >
                <View className="flex-1">
                  <Text
                    className={`text-[15px] font-semibold ${
                      editSubgroupLeaderId ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {editSubgroupLeaderId ? userMap.get(editSubgroupLeaderId)?.name ?? "Select leader" : "Select leader"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </Pressable>
            </View>

            <View className="rounded-[20px] border border-gray-200 bg-white p-4">
              <Text className="text-[13px] font-extrabold text-gray-500">Members</Text>

              <Pressable
                onPress={() => onOpenUserPicker("existingSubgroupMembers")}
                className="mt-3 flex-row items-center justify-between gap-2 rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <Text
                  className={`flex-1 text-[15px] font-semibold ${
                    memberSelectionIds.length > 0 ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  {memberSelectionIds.length > 0 ? `${memberSelectionIds.length} selected` : "Select members"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </Pressable>

              {memberSelectionIds.length > 0 ? (
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {memberSelectionIds.map((memberId) => (
                    <View
                      key={memberId}
                      className="flex-row items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2"
                    >
                      <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                        <Ionicons name="person" size={13} color="#2563EB" />
                      </View>
                      <Text className="max-w-[150px] text-[13px] font-bold text-gray-900" numberOfLines={1}>
                        {userMap.get(memberId)?.name ?? "Unnamed"}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View className="rounded-[16px] border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
              <Text className="text-[12px] font-semibold text-gray-500">
                Changes save automatically after leader or member selection.
              </Text>
            </View>

            <View className="flex-row items-center justify-end pt-1">
              <Pressable onPress={onClose} className="rounded-[14px] bg-gray-200 px-4 py-3">
                <Text className="font-extrabold text-gray-900">Close</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type UserPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pickerMode: PickerMode;
  pickerSearch: string;
  onPickerSearchChange: (text: string) => void;
  filteredUsers: UserOption[];
  pickerSelectedIds: string[];
  pickerBlockedIds: Set<string>;
  onToggleUser: (userId: string) => void;
  selectedPickerTitle: string;
  pickerSelectedUsers: UserOption[];
};

type SelectableUserRowProps = {
  user: UserOption;
  active: boolean;
  disabled: boolean;
  pickerMode: PickerMode;
  onPress: () => void;
};

function SelectableUserRow({ user, active, disabled, pickerMode, onPress }: SelectableUserRowProps) {
  const scaleAnim = useRef(new Animated.Value(disabled ? 0.985 : 1)).current;

  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: disabled ? 0.985 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [disabled, scaleAnim]);

  const borderColor = disabled ? "#D1D5DB" : active ? "#BFDBFE" : "#E5E7EB";
  const backgroundColor = disabled ? "#F3F4F6" : active ? "#EFF6FF" : "#FFFFFF";
  const iconColor = disabled ? "#9CA3AF" : "#9CA3AF";
  const textColor = disabled ? "#9CA3AF" : "#111827";

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
      }}
    >
      <View
        style={{
          borderWidth: 1,
          borderColor,
          backgroundColor,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <Pressable
          disabled={disabled}
          onPress={onPress}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 12,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 9999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: disabled ? "#E5E7EB" : "#F3F4F6",
            }}
          >
            <Ionicons name="person" size={18} color={iconColor} />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "800",
                color: textColor,
              }}
            >
              {user.name}
            </Text>
            {disabled ? (
              <Text style={{ marginTop: 2, fontSize: 12, fontWeight: "600", color: "#9CA3AF" }}>
                Already used
              </Text>
            ) : null}
          </View>

          {disabled ? (
            <Ionicons name="lock-closed" size={20} color="#D1D5DB" />
          ) : pickerMode === "newSubgroupLeader" ? (
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
      </View>
    </Animated.View>
  );
}

export function UserPickerModal({
  visible,
  onClose,
  onConfirm,
  pickerMode,
  pickerSearch,
  onPickerSearchChange,
  filteredUsers,
  pickerSelectedIds,
  pickerBlockedIds,
  onToggleUser,
  selectedPickerTitle,
  pickerSelectedUsers,
}: UserPickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/45 px-5">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="w-full max-w-[560px] max-h-[88%] overflow-hidden rounded-[28px] bg-white shadow-lg z-[999999] elevation-30">
          <View className="bg-gray-900 px-5 py-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Ionicons
                  name={pickerMode === "newSubgroupLeader" ? "person" : "people"}
                  size={22}
                  color="white"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[18px] font-extrabold text-white">{selectedPickerTitle}</Text>
                <Text className="mt-0.5 text-[13px] font-semibold text-white/70">
                  {pickerMode === "newSubgroupLeader" ? "Choose exactly one leader" : "Pick the people you want to include"}
                </Text>
              </View>
              <Pressable onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <Ionicons name="close" size={22} color="white" />
              </Pressable>
            </View>
          </View>

          <View className="px-5 pt-5">
            <View className="mb-3 flex-row h-[52px] items-center gap-2.5 rounded-[16px] border border-gray-200 bg-white px-4">
              <Ionicons name="search" size={18} color="#6B7280" />
              <TextInput
                value={pickerSearch}
                onChangeText={onPickerSearchChange}
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
                <Text className="mb-2 text-[12px] font-extrabold uppercase tracking-[1px] text-blue-700">Selected</Text>
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
                const disabled = pickerBlockedIds.has(user.id);

                return (
                  <SelectableUserRow
                    key={user.id}
                    user={user}
                    active={active}
                    disabled={disabled}
                    pickerMode={pickerMode}
                    onPress={() => onToggleUser(user.id)}
                  />
                );
              })
            )}
          </ScrollView>

          <View className="flex-row items-center justify-end gap-2.5 px-5 pb-5 pt-2">
            <Pressable onPress={onClose} className="rounded-[14px] bg-gray-200 px-4 py-3">
              <Text className="font-extrabold text-gray-900">Close</Text>
            </Pressable>

            <Pressable onPress={onConfirm} className="rounded-[14px] bg-gray-900 px-4 py-3">
              <Text className="font-extrabold text-white">{pickerMode === "newSubgroupLeader" ? "Select" : "Done"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type DeleteConfirmModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  subgroupName?: string;
  savingAction: boolean;
};

export function DeleteConfirmModal({
  visible,
  onClose,
  onConfirm,
  subgroupName,
  savingAction,
}: DeleteConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 items-center justify-center bg-black/40">
        <View className="w-[90%] max-w-[380px] overflow-hidden rounded-[24px] bg-white shadow-xl">
          <View className="border-b border-gray-200 bg-red-50 px-6 py-5">
            <View className="flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Ionicons name="trash" size={24} color="#DC2626" />
              </View>
              <View className="flex-1">
                <Text className="text-[18px] font-extrabold text-gray-900">Delete Group</Text>
                <Text className="mt-0.5 text-[13px] font-semibold text-gray-600">{subgroupName}</Text>
              </View>
            </View>
          </View>

          <View className="px-6 py-5">
            <Text className="text-[15px] font-medium text-gray-700">
              Are you sure you want to delete this group? This action cannot be undone.
            </Text>
          </View>

          <View className="border-t border-gray-200 flex-row gap-3 px-6 py-4">
            <Pressable
              onPress={onClose}
              className="flex-1 items-center justify-center rounded-[12px] border border-gray-300 bg-white py-3"
            >
              <Text className="text-[15px] font-semibold text-gray-900">Cancel</Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              disabled={savingAction}
              className={`flex-1 items-center justify-center rounded-[12px] bg-red-600 py-3 ${savingAction ? "opacity-75" : ""}`}
            >
              <Text className="text-[15px] font-semibold text-white">{savingAction ? "Deleting..." : "Delete"}</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

type EditGroupModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  group: GroupItem | null;
  editName: string;
  onEditNameChange: (text: string) => void;
  editDescription: string;
  onEditDescriptionChange: (text: string) => void;
  editLeaderId: string;
  userMap: Map<string, UserOption>;
  onOpenUserPicker: () => void;
  selectedEditLeader: UserOption | null | undefined;
  savingAction: boolean;
};

export function EditGroupModal({
  visible,
  onClose,
  onSave,
  group,
  editName,
  onEditNameChange,
  editDescription,
  onEditDescriptionChange,
  editLeaderId,
  userMap,
  onOpenUserPicker,
  selectedEditLeader,
  savingAction,
}: EditGroupModalProps) {
  if (!group) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/45 px-5">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="w-full max-w-[520px] max-h-[86%] overflow-hidden rounded-[28px] bg-white shadow-lg z-[10000] elevation-20">
          <View className="bg-gray-900 px-5 py-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Ionicons name="create" size={22} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-[18px] font-extrabold text-white">Edit Group</Text>
                <Text className="mt-0.5 text-[13px] font-semibold text-white/70">{group.name}</Text>
              </View>
              <Pressable onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
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
              <Text className="text-[13px] font-extrabold text-gray-500">Group Name</Text>
              <TextInput
                value={editName}
                onChangeText={onEditNameChange}
                placeholder="Enter group name"
                placeholderTextColor="#9CA3AF"
                className="mt-2 rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-[15px] font-semibold text-gray-900"
              />
            </View>

            <View className="rounded-[20px] border border-gray-200 bg-white p-4">
              <Text className="text-[13px] font-extrabold text-gray-500">Description</Text>
              <TextInput
                value={editDescription}
                onChangeText={onEditDescriptionChange}
                placeholder="Enter group description"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                className="mt-2 rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] font-semibold text-gray-900"
              />
            </View>

            <View className="rounded-[20px] border border-gray-200 bg-gray-50 p-4">
              <Text className="text-[13px] font-extrabold text-gray-500">Head Ministry (Leader)</Text>
              <Pressable
                onPress={onOpenUserPicker}
                className="mt-2 flex-row items-center justify-between gap-2 rounded-[16px] border border-gray-200 bg-white px-4 py-3"
              >
                <View className="flex-1">
                  <Text
                    className={`text-[15px] font-semibold ${
                      editLeaderId ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {editLeaderId ? userMap.get(editLeaderId)?.name ?? "Select leader" : "Select leader"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </Pressable>
            </View>

            <View className="flex-row items-center justify-end gap-2.5 pt-1">
              <Pressable onPress={onClose} className="rounded-[14px] bg-gray-200 px-4 py-3">
                <Text className="font-extrabold text-gray-900">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={onSave}
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
  );
}

export default {
  NewSubgroupModal,
  AddMembersModal,
  UserPickerModal,
  EditGroupModal,
  DeleteConfirmModal,
};