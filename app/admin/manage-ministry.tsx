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

type Ministry = {
  id: string;
  name: string;
  createdAt?: Timestamp;
};

type Member = {
  id: string;
  name: string;
  ministry: string[];
};

const normalizeMinistryArray = (value: unknown) => {
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

export default function ManageMinistry() {
  const [loading, setLoading] = useState(true);
  const [savingMinistry, setSavingMinistry] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);

  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newMinistryName, setNewMinistryName] = useState("");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [activeMinistry, setActiveMinistry] = useState<Ministry | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const assignedMembers = useMemo(() => {
    if (!activeMinistry) return [];
    return members.filter((m) => m.ministry.includes(activeMinistry.name));
  }, [activeMinistry, members]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ministrySnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "ministries")),
        getDocs(collection(db, "users")),
      ]);

      const ministryData: Ministry[] = ministrySnap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Ministry, "id">),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const memberData: Member[] = usersSnap.docs
        .map((d) => {
          const raw = d.data() as any;
          return {
            id: d.id,
            name: getMemberName(raw),
            ministry: normalizeMinistryArray(raw.ministry),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      setMinistries(ministryData);
      setMembers(memberData);
    } catch {
      Alert.alert("Error", "Failed to load ministry data");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openAssignModal = (ministry: Ministry) => {
    setActiveMinistry(ministry);
    setSelectedMemberIds(
      members.filter((m) => m.ministry.includes(ministry.name)).map((m) => m.id)
    );
    setShowAssignModal(true);
  };

  const saveNewMinistry = async () => {
    const name = newMinistryName.trim();
    if (!name) return Alert.alert("Error", "Please enter ministry name");

    const exists = ministries.some((m) => m.name.toLowerCase() === name.toLowerCase());
    if (exists) return Alert.alert("Error", "Ministry already exists");

    setSavingMinistry(true);
    try {
      await addDoc(collection(db, "ministries"), {
        name,
        createdAt: Timestamp.now(),
      });
      setNewMinistryName("");
      setShowAddModal(false);
      await loadData();
    } catch {
      Alert.alert("Error", "Failed to add ministry");
    } finally {
      setSavingMinistry(false);
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const saveMembersToMinistry = async () => {
    if (!activeMinistry) return;

    setSavingMembers(true);
    try {
      const selectedSet = new Set(selectedMemberIds);
      const batchWriter = writeBatch(db);

      members.forEach((member) => {
        const hasMinistry = member.ministry.includes(activeMinistry.name);
        const shouldHave = selectedSet.has(member.id);

        if (hasMinistry === shouldHave) return;

        const nextMinistry = shouldHave
          ? Array.from(new Set([...member.ministry, activeMinistry.name]))
          : member.ministry.filter((x) => x !== activeMinistry.name);

        batchWriter.update(doc(db, "users", member.id), {
          ministry: nextMinistry,
        });
      });

      await batchWriter.commit();
      setShowAssignModal(false);
      setActiveMinistry(null);
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
        <Text style={{ fontSize: 24, fontWeight: "700" }}>Manage Ministry</Text>

        {loading ? (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator />
          </View>
        ) : ministries.length === 0 ? (
          <Text>No ministry yet</Text>
        ) : (
          ministries.map((ministry) => {
            const count = members.filter((m) => m.ministry.includes(ministry.name)).length;

            return (
              <Pressable
                key={ministry.id}
                onPress={() => openAssignModal(ministry)}
                style={{
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 14,
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "700" }}>{ministry.name}</Text>
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
            <Text style={{ fontSize: 18, fontWeight: "700" }}>Add Ministry</Text>

            <TextInput
              value={newMinistryName}
              onChangeText={setNewMinistryName}
              placeholder="Ministry name"
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
                  setNewMinistryName("");
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
                onPress={saveNewMinistry}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: "#111827",
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>
                  {savingMinistry ? "Saving..." : "Save"}
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
              <Text style={{ fontSize: 20, fontWeight: "700" }}>{activeMinistry?.name ?? "Ministry"}</Text>
              <Pressable onPress={() => setShowAssignModal(false)} style={{ padding: 6 }}>
                <Ionicons name="close" size={24} color="black" />
              </Pressable>
            </View>

            <Text style={{ fontWeight: "700" }}>
              Members in this ministry: {assignedMembers.length}
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
                      <Text>{member.ministry.length} ministry{member.ministry.length === 1 ? "" : "ies"}</Text>
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
                onPress={saveMembersToMinistry}
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