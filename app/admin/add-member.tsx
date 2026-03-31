import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
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

type OptionItem = {
  id: string;
  name: string;
};

type ExistingUserDoc = {
  name?: string;
  password?: string;
  contact?: string;
  civilStatus?: string;
  ministry?: string[] | string;
  coreGroups?: string[] | string;
};

const normalizeArray = (value: unknown) => {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
};

const joinLabel = (items: string[]) => {
  if (items.length === 0) return "";
  if (items.length <= 2) return items.join(", ");
  return `${items.slice(0, 2).join(", ")} +${items.length - 2}`;
};

export default function AddMember() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [contact, setContact] = useState("");
  const [civilStatus, setCivilStatus] = useState("");

  const [ministryOptions, setMinistryOptions] = useState<OptionItem[]>([]);
  const [coreGroupOptions, setCoreGroupOptions] = useState<OptionItem[]>([]);

  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
  const [selectedCoreGroups, setSelectedCoreGroups] = useState<string[]>([]);

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showMinistryModal, setShowMinistryModal] = useState(false);
  const [showCoreGroupModal, setShowCoreGroupModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoadingOptions(true);
      try {
        const [ministrySnap, coreGroupSnap] = await Promise.all([
          getDocs(collection(db, "ministries")),
          getDocs(collection(db, "coreGroups")),
        ]);

        const ministries = ministrySnap.docs
          .map((d) => ({
            id: d.id,
            name: String((d.data() as any)?.name ?? "").trim(),
          }))
          .filter((x) => x.name)
          .sort((a, b) => a.name.localeCompare(b.name));

        const coreGroups = coreGroupSnap.docs
          .map((d) => ({
            id: d.id,
            name: String((d.data() as any)?.name ?? "").trim(),
          }))
          .filter((x) => x.name)
          .sort((a, b) => a.name.localeCompare(b.name));

        setMinistryOptions(ministries);
        setCoreGroupOptions(coreGroups);
      } catch {
        Alert.alert("Error", "Failed to load selection options");
      } finally {
        setLoadingOptions(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const snap = await getDoc(doc(db, "users", String(id)));
      const d = snap.data() as ExistingUserDoc | undefined;
      if (!d) return;

      setName(String(d.name ?? ""));
      setPassword(String(d.password ?? ""));
      setContact(String(d.contact ?? ""));
      setCivilStatus(String(d.civilStatus ?? ""));
      setSelectedMinistries(normalizeArray(d.ministry));
      setSelectedCoreGroups(normalizeArray(d.coreGroups));
    };
    load();
  }, [id]);

  const toggleSelected = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    );
  };

  const save = async () => {
    if (!name || !password || !contact || !civilStatus || selectedMinistries.length === 0 || selectedCoreGroups.length === 0) {
      return Alert.alert("Error", "Fill all fields");
    }

    setSaving(true);
    try {
      const data = {
        name,
        password,
        contact,
        civilStatus,
        ministry: selectedMinistries,
        coreGroups: selectedCoreGroups,
        role: "member",
      };

      if (id) {
        await updateDoc(doc(db, "users", String(id)), data);
      } else {
        await addDoc(collection(db, "users"), data);
      }

      router.replace("./manage-members");
    } catch {
      Alert.alert("Error", "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const renderMultiSelectModal = (
    visible: boolean,
    title: string,
    options: OptionItem[],
    selected: string[],
    onClose: () => void,
    onToggle: (value: string) => void
  ) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: "white",
            borderRadius: 16,
            padding: 16,
            maxHeight: "80%",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 12 }}>{title}</Text>

          {options.length === 0 ? (
            <Text>No options available</Text>
          ) : (
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 10 }}>
              {options.map((item) => {
                const active = selected.includes(item.name);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => onToggle(item.name)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      borderWidth: 1,
                      borderColor: active ? "#16a34a" : "#d1d5db",
                      backgroundColor: active ? "#dcfce7" : "white",
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: active ? "#16a34a" : "#9ca3af",
                        backgroundColor: active ? "#16a34a" : "transparent",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {active ? (
                        <Text style={{ color: "white", fontSize: 14, fontWeight: "700" }}>✓</Text>
                      ) : null}
                    </View>
                    <Text style={{ fontWeight: "700" }}>{item.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Pressable
            onPress={onClose}
            style={{
              marginTop: 14,
              alignSelf: "flex-end",
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
            }}
          >
            <Text>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );

  if (loadingOptions && !id) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>{id ? "Edit Member" : "Add Member"}</Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
        />

        <TextInput
          value={contact}
          onChangeText={setContact}
          placeholder="Contact"
          style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
        />

        <TextInput
          value={civilStatus}
          onChangeText={setCivilStatus}
          placeholder="Civil Status"
          style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
        />

        <Pressable
          onPress={() => setShowMinistryModal(true)}
          style={{
            borderWidth: 1,
            padding: 12,
            borderRadius: 10,
            minHeight: 48,
            justifyContent: "center",
          }}
        >
          <Text style={{ color: selectedMinistries.length ? "#111827" : "#9ca3af" }}>
            {selectedMinistries.length ? joinLabel(selectedMinistries) : "Select Ministry"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowCoreGroupModal(true)}
          style={{
            borderWidth: 1,
            padding: 12,
            borderRadius: 10,
            minHeight: 48,
            justifyContent: "center",
          }}
        >
          <Text style={{ color: selectedCoreGroups.length ? "#111827" : "#9ca3af" }}>
            {selectedCoreGroups.length ? joinLabel(selectedCoreGroups) : "Select Core Groups"}
          </Text>
        </Pressable>

        <Pressable
          onPress={save}
          disabled={saving}
          style={{
            borderWidth: 1,
            padding: 12,
            borderRadius: 10,
            alignItems: "center",
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Text>{saving ? "Saving..." : id ? "Update Member" : "Add Member"}</Text>
        </Pressable>
      </ScrollView>

      {renderMultiSelectModal(
        showMinistryModal,
        "Select Ministry",
        ministryOptions,
        selectedMinistries,
        () => setShowMinistryModal(false),
        (value) => toggleSelected(value, setSelectedMinistries)
      )}

      {renderMultiSelectModal(
        showCoreGroupModal,
        "Select Core Groups",
        coreGroupOptions,
        selectedCoreGroups,
        () => setShowCoreGroupModal(false),
        (value) => toggleSelected(value, setSelectedCoreGroups)
      )}
    </>
  );
}