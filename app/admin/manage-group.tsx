import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    Timestamp,
    addDoc,
    collection,
    doc,
    getDocs,
    updateDoc,
} from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
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

const makeLocalId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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
  const [pickerSubgroupIndex, setPickerSubgroupIndex] = useState<number | null>(
    null
  );
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
    } catch {
      Alert.alert("Error", "Failed to load group data");
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
        subgroupDrafts[subgroupIndex]?.leaderId
          ? [subgroupDrafts[subgroupIndex].leaderId]
          : []
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
          index === pickerSubgroupIndex
            ? { ...item, memberIds: [...pickerSelectedIds] }
            : item
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
      return Alert.alert(
        "Error",
        `Please enter ${activeInfo.label.toLowerCase()} name`
      );
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

    const currentList = activeKind === "ministry" ? ministries : coreGroups;
    const exists = currentList.some((group) => {
      if (editingGroup && group.id === editingGroup.id) return false;
      return group.name.toLowerCase() === name.toLowerCase();
    });

    if (exists) return Alert.alert("Error", `${activeInfo.label} already exists`);

    setSavingGroup(true);
    try {
      const payload = {
        name,
        description,
        leaderId: leader.id,
        leaderName: leader.name,
        leaderRole: leader.role,
        isActive: newGroupIsActive,
        createdAt: editingGroup?.createdAt ?? Timestamp.now(),
        updatedAt: Timestamp.now(),
        subgroups: subgroupDrafts.map((subgroup, index) => {
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
            memberIds: subgroup.memberIds,
            memberNames: subgroupMembers.map((member) => member.name),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
        }),
      };

      if (editingGroup) {
        await updateDoc(doc(db, activeInfo.collectionName, editingGroup.id), payload);
      } else {
        await addDoc(collection(db, activeInfo.collectionName), payload);
      }

      setNewGroupName("");
      setNewGroupDescription("");
      setSelectedLeaderId("");
      setEditingGroup(null);
      setNewGroupIsActive(true);
      setSubgroupDrafts([{ localId: makeLocalId(), leaderId: "", memberIds: [] }]);
      setShowAddModal(false);
      await loadData();
    } catch {
      Alert.alert("Error", `Failed to save ${activeInfo.label.toLowerCase()}`);
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
        ? `Select Group ${pickerSubgroupIndex !== null ? indexToLetters(pickerSubgroupIndex) : ""} Leader`
        : `Select Group ${pickerSubgroupIndex !== null ? indexToLetters(pickerSubgroupIndex) : ""} Members`;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Manage Group</Text>

        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setActiveKind("ministry")}
            style={({ pressed }) => [
              styles.tabButton,
              activeKind === "ministry" && styles.tabButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeKind === "ministry" && styles.tabTextActive,
              ]}
            >
              Ministries
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveKind("coreGroup")}
            style={({ pressed }) => [
              styles.tabButton,
              activeKind === "coreGroup" && styles.tabButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeKind === "coreGroup" && styles.tabTextActive,
              ]}
            >
              Core Groups
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator />
          </View>
        ) : activeGroups.length === 0 ? (
          <Text style={styles.emptyText}>{activeInfo.emptyText}</Text>
        ) : (
          activeGroups.map((group) => {
            const expanded = expandedGroupId === group.id;

            return (
              <View key={group.id} style={styles.cardWrap}>
                <Pressable
                  onPress={() => openGroupBoard(group)}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                >
                  <Text style={styles.cardTitle}>{group.name}</Text>
                  {!!group.description && (
                    <Text style={styles.cardDescription}>{group.description}</Text>
                  )}

                  <View style={styles.cardFooter}>
                    <Text style={styles.cardLeader}>
                      Leader: {group.leaderName || "Not set"}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => openEditModal(group)}
                  style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
                >
                  <Ionicons name="create-outline" size={18} color="#111827" />
                </Pressable>

                <Pressable
                  onPress={() =>
                    setExpandedGroupId((prev) => (prev === group.id ? null : group.id))
                  }
                  style={({ pressed }) => [
                    styles.dropdownButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#111827"
                  />
                </Pressable>

                {expanded ? (
                  <View style={styles.subgroupGrid}>
                    {group.subgroups.length === 0 ? (
                      <Text style={styles.emptyText}>No subgroups yet</Text>
                    ) : (
                      group.subgroups.map((subgroup, index) => (
                        <View key={subgroup.id} style={styles.subgroupCard}>
                          <Text style={styles.subgroupTitle}>
                            {subgroup.name || `Group ${indexToLetters(index)}`}
                          </Text>
                          <Text style={styles.subgroupLeader}>
                            Leader: {subgroup.leaderName || "Not set"}
                          </Text>

                          <View style={styles.memberList}>
                            {subgroup.memberNames.length > 0 ? (
                              subgroup.memberNames.map((memberName, memberIndex) => (
                                <View
                                  key={`${subgroup.id}-${memberIndex}`}
                                  style={styles.memberRow}
                                >
                                  <Text style={styles.memberBullet}>•</Text>
                                  <Text style={styles.memberName}>{memberName}</Text>
                                </View>
                              ))
                            ) : (
                              <Text style={styles.emptyText}>No members</Text>
                            )}
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Pressable
        onPress={() => openCreateModal(activeKind)}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
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
          style={styles.bottomBackdrop}
          onPress={() => setShowAddModal(false)}
        >
          <Pressable style={styles.bottomSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitleCenter}>
              {editingGroup
                ? `Edit ${activeInfo.label}`
                : activeKind === "ministry"
                  ? "New Ministry"
                  : "New Core Group"}
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetContent}
            >
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  placeholder={activeInfo.placeholder}
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  value={newGroupDescription}
                  onChangeText={setNewGroupDescription}
                  placeholder="Write a short description"
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, styles.textArea]}
                />
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Leader</Text>
                <Pressable
                  onPress={() => openUserPicker("groupLeader")}
                  style={({ pressed }) => [
                    styles.selectorButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={
                      selectedLeader ? styles.selectorValue : styles.selectorPlaceholder
                    }
                  >
                    {selectedLeader ? selectedLeader.name : "Select from users"}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#6B7280" />
                </Pressable>
              </View>

              <View style={styles.subgroupSection}>
                <View style={styles.subgroupSectionHeader}>
                  <Text style={styles.subgroupSectionTitle}>Subgroups</Text>
                  <Pressable
                    onPress={addSubgroup}
                    style={({ pressed }) => [styles.addSubgroupButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.addSubgroupButtonText}>Add</Text>
                  </Pressable>
                </View>

                {subgroupDrafts.map((subgroup, index) => {
                  const subgroupLeader =
                    users.find((user) => user.id === subgroup.leaderId) || null;
                  const subgroupMembers = subgroup.memberIds
                    .map((memberId) => users.find((user) => user.id === memberId))
                    .filter((x): x is UserOption => Boolean(x));

                  return (
                    <View key={subgroup.localId} style={styles.subgroupEditCard}>
                      <View style={styles.subgroupEditHeader}>
                        <Text style={styles.subgroupEditTitle}>
                          Group {indexToLetters(index)}
                        </Text>
                        {subgroupDrafts.length > 1 ? (
                          <Pressable
                            onPress={() => removeSubgroup(index)}
                            style={({ pressed }) => [
                              styles.removeSubgroupButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Ionicons name="trash-outline" size={18} color="#DC2626" />
                          </Pressable>
                        ) : null}
                      </View>

                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>Leader</Text>
                        <Pressable
                          onPress={() => openUserPicker("subgroupLeader", index)}
                          style={({ pressed }) => [
                            styles.selectorButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={
                              subgroupLeader
                                ? styles.selectorValue
                                : styles.selectorPlaceholder
                            }
                          >
                            {subgroupLeader ? subgroupLeader.name : "Select leader"}
                          </Text>
                          <Ionicons name="chevron-down" size={18} color="#6B7280" />
                        </Pressable>
                      </View>

                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>Members</Text>
                        <Pressable
                          onPress={() => openUserPicker("subgroupMembers", index)}
                          style={({ pressed }) => [
                            styles.selectorButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={
                              subgroupMembers.length > 0
                                ? styles.selectorValue
                                : styles.selectorPlaceholder
                            }
                          >
                            {subgroupMembers.length > 0
                              ? `${subgroupMembers.length} selected`
                              : "Select members"}
                          </Text>
                          <Ionicons name="chevron-down" size={18} color="#6B7280" />
                        </Pressable>
                      </View>

                      <View style={styles.memberList}>
                        {subgroupMembers.length > 0 ? (
                          subgroupMembers.map((member) => (
                            <View key={member.id} style={styles.memberRow}>
                              <Text style={styles.memberBullet}>•</Text>
                              <Text style={styles.memberName}>{member.name}</Text>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.emptyText}>No members selected</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.sheetActions}>
                <Pressable
                  onPress={() => setNewGroupIsActive((prev) => !prev)}
                  style={({ pressed }) => [
                    styles.statusToggle,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={newGroupIsActive ? "Set inactive" : "Set active"}
                >
                  <View
                    style={[
                      styles.statusDotLarge,
                      { backgroundColor: newGroupIsActive ? "#22C55E" : "#EF4444" },
                    ]}
                  />
                </Pressable>

                <View style={{ flex: 1 }} />

                <Pressable
                  onPress={() => setShowAddModal(false)}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={saveGroup}
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.pressed,
                    savingGroup && { opacity: 0.75 },
                  ]}
                  disabled={savingGroup}
                >
                  <Text style={styles.saveButtonText}>
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
        <Pressable style={styles.bottomBackdrop} onPress={closeUserPicker}>
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitleCenter}>{selectedPickerTitle}</Text>

            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color="#6B7280" />
              <TextInput
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search users"
                placeholderTextColor="#9CA3AF"
                style={styles.searchInput}
              />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
            >
              {filteredUsers.length === 0 ? (
                <Text style={styles.emptyTextCenter}>No users found</Text>
              ) : (
                filteredUsers.map((user) => {
                  const active = pickerSelectedIds.includes(user.id);

                  return (
                    <Pressable
                      key={user.id}
                      onPress={() => togglePickerUser(user.id)}
                      style={({ pressed }) => [
                        styles.userRow,
                        active && styles.userRowActive,
                        pressed && styles.pressedOption,
                      ]}
                    >
                      <View style={styles.userAvatar}>
                        <Ionicons name="person" size={18} color="#9CA3AF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>{user.name}</Text>
                        {!!user.role && <Text style={styles.userRole}>{user.role}</Text>}
                      </View>
                      {pickerMode === "subgroupMembers" ? (
                        active ? (
                          <Ionicons name="checkbox" size={22} color="#16A34A" />
                        ) : (
                          <Ionicons
                            name="square-outline"
                            size={22}
                            color="#9CA3AF"
                          />
                        )
                      ) : active ? (
                        <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={22}
                          color="#9CA3AF"
                        />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.pickerActions}>
              <Pressable
                onPress={closeUserPicker}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </Pressable>

              <Pressable
                onPress={confirmUserPicker}
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.saveButtonText}>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  container: {
    padding: 20,
    paddingBottom: 110,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: "#111827",
  },
  tabText: {
    fontWeight: "700",
    color: "#111827",
  },
  tabTextActive: {
    color: "white",
  },
  emptyText: {
    color: "#6B7280",
  },
  emptyTextCenter: {
    textAlign: "center",
    color: "#6B7280",
    paddingVertical: 20,
  },
  cardWrap: {
    position: "relative",
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    backgroundColor: "#fff",
    position: "relative",
  },
  editButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
  },
  dropdownButton: {
    position: "absolute",
    top: 50,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    paddingRight: 46,
  },
  cardDescription: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    paddingRight: 10,
  },
  cardFooter: {
    marginTop: 4,
    gap: 4,
    paddingRight: 46,
  },
  cardLeader: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },
  subgroupGrid: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  subgroupCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 180,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 10,
    backgroundColor: "#FAFAFA",
    gap: 8,
    minHeight: 120,
  },
  subgroupTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  subgroupLeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
  },
  memberList: {
    gap: 4,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  memberBullet: {
    fontSize: 14,
    lineHeight: 18,
    color: "#111827",
    fontWeight: "800",
  },
  memberName: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#111827",
    fontWeight: "600",
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
  bottomBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    maxHeight: "90%",
  },
  pickerSheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    maxHeight: "90%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 99,
    backgroundColor: "#D1D5DB",
    marginBottom: 14,
  },
  sheetTitleCenter: {
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
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
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
    minHeight: 96,
  },
  selectorButton: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectorPlaceholder: {
    fontSize: 15,
    color: "#9CA3AF",
    fontWeight: "600",
    flex: 1,
  },
  selectorValue: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "700",
    flex: 1,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#fff",
  },
  userRowActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontWeight: "800",
    color: "#111827",
    fontSize: 15,
  },
  userRole: {
    marginTop: 2,
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },
  sheetActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 4,
  },
  pickerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    paddingTop: 6,
  },
  statusToggle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  statusDotLarge: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
  },
  cancelButtonText: {
    fontWeight: "800",
    color: "#111827",
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#111827",
  },
  saveButtonText: {
    fontWeight: "800",
    color: "#fff",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  pressedOption: {
    backgroundColor: "#F3F4F6",
  },
  subgroupSection: {
    gap: 12,
  },
  subgroupSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subgroupSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  addSubgroupButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#111827",
  },
  addSubgroupButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
  subgroupEditCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#FAFAFA",
    gap: 12,
  },
  subgroupEditHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subgroupEditTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  removeSubgroupButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    marginTop: 12,
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
  },
  closeButtonText: {
    fontWeight: "800",
    color: "#111827",
  },
});