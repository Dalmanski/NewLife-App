import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
    Timestamp,
    addDoc,
    collection,
    doc,
    getDocs,
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

type CoreGroup = {
  id: string;
  name: string;
  createdAt?: Timestamp;
};

type Member = {
  id: string;
  name: string;
  coreGroup: string[];
};

const normalizeCoreGroupArray = (value: unknown) => {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
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

export default function ManageCoreGroup() {
  const [loading, setLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);

  const [groups, setGroups] = useState<CoreGroup[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [activeGroup, setActiveGroup] = useState<CoreGroup | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const assignedMembers = useMemo(() => {
    if (!activeGroup) return [];
    return members.filter((m) => m.coreGroup.includes(activeGroup.name));
  }, [activeGroup, members]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "coreGroups")),
        getDocs(collection(db, "users")),
      ]);

      const groupData: CoreGroup[] = groupSnap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CoreGroup, "id">),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const memberData: Member[] = usersSnap.docs
        .map((d) => {
          const raw = d.data() as any;
          return {
            id: d.id,
            name: getMemberName(raw),
            coreGroup: normalizeCoreGroupArray(raw.coreGroup),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      setGroups(groupData);
      setMembers(memberData);
    } catch {
      Alert.alert("Error", "Failed to load core group data");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openAssignModal = (group: CoreGroup) => {
    setActiveGroup(group);
    setSelectedMemberIds(
      members.filter((m) => m.coreGroup.includes(group.name)).map((m) => m.id)
    );
    setShowAssignModal(true);
  };

  const saveNewGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return Alert.alert("Error", "Please enter core group name");

    const exists = groups.some((g) => g.name.toLowerCase() === name.toLowerCase());
    if (exists) return Alert.alert("Error", "Core group already exists");

    setSavingGroup(true);
    try {
      await addDoc(collection(db, "coreGroups"), {
        name,
        createdAt: Timestamp.now(),
      });
      setNewGroupName("");
      setShowAddModal(false);
      await loadData();
    } catch {
      Alert.alert("Error", "Failed to add core group");
    } finally {
      setSavingGroup(false);
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const saveMembersToGroup = async () => {
    if (!activeGroup) return;

    setSavingMembers(true);
    try {
      const selectedSet = new Set(selectedMemberIds);
      const batchWriter = writeBatch(db);

      members.forEach((member) => {
        const hasGroup = member.coreGroup.includes(activeGroup.name);
        const shouldHave = selectedSet.has(member.id);

        if (hasGroup === shouldHave) return;

        const nextCoreGroup = shouldHave
          ? Array.from(new Set([...member.coreGroup, activeGroup.name]))
          : member.coreGroup.filter((x) => x !== activeGroup.name);

        batchWriter.update(doc(db, "users", member.id), {
          coreGroup: nextCoreGroup,
        });
      });

      await batchWriter.commit();
      setShowAssignModal(false);
      setActiveGroup(null);
      setSelectedMemberIds([]);
      await loadData();
    } catch {
      Alert.alert("Error", "Failed to save members");
    } finally {
      setSavingMembers(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>Manage Core Group</Text>

        {loading ? (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator />
          </View>
        ) : groups.length === 0 ? (
          <Text>No core group yet</Text>
        ) : (
          groups.map((group) => {
            const count = members.filter((m) => m.coreGroup.includes(group.name)).length;

            return (
              <Pressable
                key={group.id}
                onPress={() => openAssignModal(group)}
                style={{
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 14,
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "700" }}>{group.name}</Text>
                <Text>{count} member{count === 1 ? "" : "s"}</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Pressable
        onPress={() => setShowAddModal(true)}
        style={{
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
        }}
      >
        <Ionicons name="add" size={32} color="white" />
      </Pressable>

      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>Add Core Group</Text>

            <TextInput
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Core group name"
              style={{
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            />

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
              <Pressable
                onPress={() => {
                  setShowAddModal(false);
                  setNewGroupName("");
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: "#e5e7eb",
                }}
              >
                <Text style={{ fontWeight: "700" }}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={saveNewGroup}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: "#111827",
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>
                  {savingGroup ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAssignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
              gap: 12,
              maxHeight: "88%",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 20, fontWeight: "700" }}>{activeGroup?.name ?? "Core Group"}</Text>
              <Pressable onPress={() => setShowAssignModal(false)} style={{ padding: 6 }}>
                <Ionicons name="close" size={24} color="black" />
              </Pressable>
            </View>

            <Text style={{ fontWeight: "700" }}>
              Members in this group: {assignedMembers.length}
            </Text>

            <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
              {assignedMembers.length === 0 ? (
                <Text>No member assigned yet</Text>
              ) : (
                assignedMembers.map((member) => (
                  <View
                    key={member.id}
                    style={{
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <Text style={{ fontWeight: "700" }}>{member.name}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <Text style={{ fontSize: 16, fontWeight: "700" }}>Assign Members</Text>

            <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
              {members.map((member) => {
                const checked = selectedMemberIds.includes(member.id);
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => toggleMember(member.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: checked ? "#16a34a" : "#9ca3af",
                        backgroundColor: checked ? "#16a34a" : "transparent",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {checked ? (
                        <Text style={{ color: "white", fontSize: 14, fontWeight: "700" }}>✓</Text>
                      ) : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "700" }}>{member.name}</Text>
                      <Text>{member.coreGroup.length} group{member.coreGroup.length === 1 ? "" : "s"}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
              <Pressable
                onPress={() => setShowAssignModal(false)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: "#e5e7eb",
                }}
              >
                <Text style={{ fontWeight: "700" }}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={saveMembersToGroup}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: "#111827",
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>
                  {savingMembers ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}