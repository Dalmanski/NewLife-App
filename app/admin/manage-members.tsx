import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
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

type Member = {
  id: string;
  name: string;
  password?: string;
  contact?: string;
  civilStatus?: string;
  ministry: string[];
  coreGroup: string[];
  role?: string;
  idx?: number;
};

type OptionItem = {
  id: string;
  name: string;
};

type SortBy = "name-asc" | "name-desc" | "idx";

type ActiveSelector = "ministry" | "coreGroup" | null;

const normalizeArray = (value: unknown) => {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
};

const formatList = (items?: string[]) => {
  if (!items || items.length === 0) return "";
  if (items.length <= 2) return items.join(", ");
  return `${items.slice(0, 2).join(", ")} +${items.length - 2}`;
};

const joinLabel = (items: string[]) => {
  if (items.length === 0) return "";
  if (items.length <= 2) return items.join(", ");
  return `${items.slice(0, 2).join(", ")} +${items.length - 2}`;
};

const emptyForm = {
  name: "",
  password: "",
  contact: "",
  civilStatus: "",
};

export default function ManageMembers() {
  const router = useRouter();

  const [items, setItems] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name-asc");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [ministryOptions, setMinistryOptions] = useState<OptionItem[]>([]);
  const [coreGroupOptions, setCoreGroupOptions] = useState<OptionItem[]>([]);
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
  const [selectedCoreGroups, setSelectedCoreGroups] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [activeSelector, setActiveSelector] = useState<ActiveSelector>(null);

  const load = async () => {
    const snap = await getDocs(collection(db, "users"));
    setItems(
      snap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: String(data?.name ?? ""),
            password: String(data?.password ?? ""),
            contact: String(data?.contact ?? ""),
            civilStatus: String(data?.civilStatus ?? ""),
            ministry: normalizeArray(data?.ministry),
            coreGroup: normalizeArray(data?.coreGroup ?? data?.coreGroups),
            role: String(data?.role ?? ""),
            idx: typeof data?.idx === "number" ? data.idx : undefined,
          };
        })
        .filter((x) => x.role !== "admin")
    );
  };

  const loadOptions = async () => {
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

  useEffect(() => {
    load();
    loadOptions();
  }, []);

  const list = useMemo(() => {
    const q = search.toLowerCase().trim();

    const filtered = [...items].filter((x) =>
      `${x.name} ${x.contact ?? ""} ${x.civilStatus ?? ""} ${x.ministry?.join(" ") ?? ""} ${
        x.coreGroup?.join(" ") ?? ""
      } ${x.idx ?? ""}`
        .toLowerCase()
        .includes(q)
    );

    if (sortBy === "name-asc") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "name-desc") {
      filtered.sort((a, b) => b.name.localeCompare(a.name));
    } else {
      filtered.sort((a, b) => {
        const aIdx = typeof a.idx === "number" ? a.idx : Number.MAX_SAFE_INTEGER;
        const bIdx = typeof b.idx === "number" ? b.idx : Number.MAX_SAFE_INTEGER;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return a.name.localeCompare(b.name);
      });
    }

    return filtered;
  }, [items, search, sortBy]);

  const remove = (id: string) => {
    Alert.alert("Delete", "Remove this member?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "users", id));
          await load();
        },
      },
    ]);
  };

  const toggleOpen = (id: string) => {
    setOpenId((current) => (current === id ? null : id));
  };

  const sortLabel = sortBy === "name-asc" ? "A-Z" : sortBy === "name-desc" ? "Z-A" : "Idx";

  const openAddMember = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedMinistries([]);
    setSelectedCoreGroups([]);
    setFormOpen(true);
  };

  const openEditMember = (item: Member) => {
    setEditingId(item.id);
    setForm({
      name: item.name ?? "",
      password: item.password ?? "",
      contact: item.contact ?? "",
      civilStatus: item.civilStatus ?? "",
    });
    setSelectedMinistries(item.ministry ?? []);
    setSelectedCoreGroups(item.coreGroup ?? []);
    setFormOpen(true);
  };

  const openSelector = (kind: ActiveSelector) => {
    setActiveSelector(kind);
    setSelectorOpen(true);
  };

  const toggleSelected = (value: string, kind: ActiveSelector) => {
    if (kind === "ministry") {
      setSelectedMinistries((prev) =>
        prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
      );
      return;
    }

    if (kind === "coreGroup") {
      setSelectedCoreGroups((prev) =>
        prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
      );
    }
  };

  const save = async () => {
    if (
      !form.name.trim() ||
      !form.password.trim() ||
      !form.contact.trim() ||
      !form.civilStatus.trim() ||
      selectedMinistries.length === 0 ||
      selectedCoreGroups.length === 0
    ) {
      return Alert.alert("Error", "Fill all fields");
    }

    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        password: form.password.trim(),
        contact: form.contact.trim(),
        civilStatus: form.civilStatus.trim(),
        ministry: selectedMinistries,
        coreGroup: selectedCoreGroups,
        coreGroups: selectedCoreGroups,
        role: "member",
      };

      if (editingId) {
        await updateDoc(doc(db, "users", editingId), data);
      } else {
        await addDoc(collection(db, "users"), data);
      }

      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setSelectedMinistries([]);
      setSelectedCoreGroups([]);
      await load();
    } catch {
      Alert.alert("Error", "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const activeOptions = activeSelector === "ministry" ? ministryOptions : coreGroupOptions;
  const activeTitle = activeSelector === "ministry" ? "Select Ministry" : "Select Core Groups";
  const activeSelected =
    activeSelector === "ministry" ? selectedMinistries : selectedCoreGroups;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Manage Members</Text>

        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={20} color="#6B7280" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search members"
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
        </View>

        <Pressable
          onPress={() => setSortOpen(true)}
          style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}
        >
          <MaterialIcons name="sort" size={20} color="#111827" />
          <Text style={styles.sortButtonText}>Sort: {sortLabel}</Text>
          <MaterialIcons name="arrow-drop-down" size={22} color="#111827" />
        </Pressable>

        <View style={styles.list}>
          {list.map((item) => {
            const isOpen = openId === item.id;

            return (
              <View key={item.id} style={styles.card}>
                <Pressable
                  onPress={() => toggleOpen(item.id)}
                  style={({ pressed }) => [styles.memberHeader, pressed && styles.memberHeaderPressed]}
                >
                  <View style={styles.avatar}>
                    <MaterialIcons name="person" size={24} color="#9CA3AF" />
                  </View>

                  <Text style={styles.memberName}>{item.name}</Text>

                  <MaterialIcons
                    name={isOpen ? "expand-less" : "expand-more"}
                    size={24}
                    color="#6B7280"
                  />
                </Pressable>

                {isOpen && (
                  <View style={styles.details}>
                    <DetailRow label="Contact" value={item.contact} />
                    <DetailRow label="Civil Status" value={item.civilStatus} />
                    <DetailRow label="Ministry" value={formatList(item.ministry)} />
                    <DetailRow label="Core Groups" value={formatList(item.coreGroup)} />
                    <DetailRow
                      label="Idx"
                      value={typeof item.idx === "number" ? String(item.idx) : undefined}
                    />

                    <View style={styles.iconActions}>
                      <Pressable
                        onPress={() => openEditMember(item)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          styles.actionButtonBlue,
                          pressed && styles.pressed,
                        ]}
                      >
                        <MaterialIcons name="edit" size={18} color="#fff" />
                        <Text style={styles.actionButtonText}>Edit</Text>
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "./member-tasks",
                            params: { id: item.id, name: item.name },
                          })
                        }
                        style={({ pressed }) => [
                          styles.actionButton,
                          styles.actionButtonPurple,
                          pressed && styles.pressed,
                        ]}
                      >
                        <MaterialIcons name="assignment" size={18} color="#fff" />
                        <Text style={styles.actionButtonText}>Show Task</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => remove(item.id)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          styles.actionButtonRed,
                          pressed && styles.pressed,
                        ]}
                      >
                        <MaterialIcons name="delete" size={18} color="#fff" />
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Pressable
        onPress={openAddMember}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      >
        <MaterialIcons name="person-add-alt-1" size={24} color="#fff" />
      </Pressable>

      <Modal
        visible={formOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFormOpen(false)}
      >
        <Pressable style={styles.bottomBackdrop} onPress={() => setFormOpen(false)}>
          <Pressable style={styles.bottomSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{editingId ? "Edit Member" : "Add Member"}</Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetContent}
            >
              <TextInput
                value={form.name}
                onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
                placeholder="Name"
                style={styles.input}
              />

              <TextInput
                value={form.password}
                onChangeText={(value) => setForm((prev) => ({ ...prev, password: value }))}
                placeholder="Password"
                secureTextEntry
                style={styles.input}
              />

              <TextInput
                value={form.contact}
                onChangeText={(value) => setForm((prev) => ({ ...prev, contact: value }))}
                placeholder="Contact"
                style={styles.input}
              />

              <TextInput
                value={form.civilStatus}
                onChangeText={(value) => setForm((prev) => ({ ...prev, civilStatus: value }))}
                placeholder="Civil Status"
                style={styles.input}
              />

              <Pressable
                onPress={() => openSelector("ministry")}
                style={({ pressed }) => [styles.selectButton, pressed && styles.pressed]}
              >
                <Text style={styles.selectLabel}>Ministry</Text>
                <Text style={styles.selectValue}>
                  {selectedMinistries.length ? joinLabel(selectedMinistries) : "Select Ministry"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => openSelector("coreGroup")}
                style={({ pressed }) => [styles.selectButton, pressed && styles.pressed]}
              >
                <Text style={styles.selectLabel}>Core Groups</Text>
                <Text style={styles.selectValue}>
                  {selectedCoreGroups.length
                    ? joinLabel(selectedCoreGroups)
                    : "Select Core Groups"}
                </Text>
              </Pressable>

              <View style={styles.sheetActions}>
                <Pressable
                  onPress={() => setFormOpen(false)}
                  style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={save}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.pressed,
                    saving && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.saveButtonText}>
                    {saving ? "Saving..." : editingId ? "Update Member" : "Add Member"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={selectorOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectorOpen(false)}
      >
        <Pressable style={styles.bottomBackdrop} onPress={() => setSelectorOpen(false)}>
          <Pressable style={styles.selectorSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{activeTitle}</Text>

            <ScrollView
              style={{ maxHeight: 430 }}
              contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {loadingOptions ? (
                <View style={{ paddingVertical: 20 }}>
                  <Text style={{ textAlign: "center", color: "#6B7280" }}>Loading...</Text>
                </View>
              ) : activeOptions.length === 0 ? (
                <Text style={{ textAlign: "center", color: "#6B7280", paddingVertical: 20 }}>
                  No options available
                </Text>
              ) : (
                activeOptions.map((item) => {
                  const active = activeSelected.includes(item.name);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => toggleSelected(item.name, activeSelector)}
                      style={({ pressed }) => [
                        styles.optionRow,
                        active && styles.optionRowActive,
                        pressed && styles.pressedOption,
                      ]}
                    >
                      <View style={styles.optionCheck}>
                        {active ? <Text style={styles.optionCheckText}>✓</Text> : null}
                      </View>
                      <Text style={styles.optionText}>{item.name}</Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <Pressable
              onPress={() => setSelectorOpen(false)}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={sortOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSortOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Sort by</Text>

            <Pressable
              onPress={() => {
                setSortBy("name-asc");
                setSortOpen(false);
              }}
              style={({ pressed }) => [
                styles.optionRow,
                sortBy === "name-asc" && styles.optionRowActive,
                pressed && styles.pressedOption,
              ]}
            >
              <Text style={styles.optionText}>A-Z</Text>
              {sortBy === "name-asc" && <MaterialIcons name="check" size={18} color="#2563EB" />}
            </Pressable>

            <Pressable
              onPress={() => {
                setSortBy("name-desc");
                setSortOpen(false);
              }}
              style={({ pressed }) => [
                styles.optionRow,
                sortBy === "name-desc" && styles.optionRowActive,
                pressed && styles.pressedOption,
              ]}
            >
              <Text style={styles.optionText}>Z-A</Text>
              {sortBy === "name-desc" && <MaterialIcons name="check" size={18} color="#2563EB" />}
            </Pressable>

            <Pressable
              onPress={() => {
                setSortBy("idx");
                setSortOpen(false);
              }}
              style={({ pressed }) => [
                styles.optionRow,
                sortBy === "idx" && styles.optionRowActive,
                pressed && styles.pressedOption,
              ]}
            >
              <Text style={styles.optionText}>Idx</Text>
              {sortBy === "idx" && <MaterialIcons name="check" size={18} color="#2563EB" />}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  if (!value) return null;

  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 16,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  list: {
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  memberHeaderPressed: {
    backgroundColor: "#F9FAFB",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  memberName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  details: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  detailRow: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "600",
  },
  iconActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 2,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  actionButtonBlue: {
    backgroundColor: "#2563EB",
  },
  actionButtonPurple: {
    backgroundColor: "#7C3AED",
  },
  actionButtonRed: {
    backgroundColor: "#DC2626",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bottomBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    maxHeight: "90%",
  },
  selectorSheet: {
    backgroundColor: "#fff",
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
  sheetTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 14,
  },
  sheetContent: {
    gap: 12,
    paddingBottom: 10,
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
  selectButton: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    gap: 4,
  },
  selectLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  selectValue: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "700",
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    paddingTop: 4,
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
  optionRow: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
  },
  optionRowActive: {
    backgroundColor: "#EFF6FF",
  },
  optionCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  optionCheckText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#16A34A",
  },
  optionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    paddingTop: 180,
    paddingLeft: 20,
  },
  modalCard: {
    width: 170,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  modalTitle: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  pressedOption: {
    backgroundColor: "#F3F4F6",
  },
});