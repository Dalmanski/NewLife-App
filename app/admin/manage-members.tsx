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
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { db } from "../../lib/firebaseConfig";

type MemberStatus = "unregister" | "pending" | "register";
type MemberRole = "member" | "admin";
type SortField = "name" | "idx";
type SortDirection = "asc" | "desc";
type ActiveSelector = "ministry" | "coreGroup" | "status" | "civilStatus" | "role" | null;

type Member = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  password?: string;
  contact?: string;
  civilStatus?: string;
  ministry: string[];
  coreGroup: string[];
  status: MemberStatus;
  role?: MemberRole;
  idx?: number;
};

type OptionItem = {
  id: string;
  name: string;
};

const normalizeArray = (value: unknown) => {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
};

const normalizeStatus = (value: unknown): MemberStatus => {
  const status = String(value ?? "").trim().toLowerCase();
  if (status === "unregister" || status === "pending" || status === "register") return status;
  return "unregister";
};

const normalizeRole = (value: unknown): MemberRole => {
  const role = String(value ?? "").trim().toLowerCase();
  if (role === "admin") return "admin";
  return "member";
};

const normalizeNA = (value: unknown) => {
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "na") return "NA";
  return text;
};

const splitFullName = (value: unknown) => {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return { firstName: "", lastName: "" };
  const parts = text.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

const emptyForm = {
  name: "",
  firstName: "",
  lastName: "",
  password: "",
  contact: "",
};

const statusLabel: Record<MemberStatus, string> = {
  unregister: "Unregister",
  pending: "Pending",
  register: "Register",
};

const statusColor: Record<MemberStatus, string> = {
  unregister: "#DC2626",
  pending: "#F59E0B",
  register: "#16A34A",
};

const roleLabel: Record<MemberRole, string> = {
  member: "Member",
  admin: "Admin",
};

const roleOptions: OptionItem[] = [
  { id: "member", name: "Member" },
  { id: "admin", name: "Admin" },
];

const statusOptions: { id: MemberStatus; name: string }[] = [
  { id: "unregister", name: "Unregister" },
  { id: "pending", name: "Pending" },
  { id: "register", name: "Register" },
];

const civilStatusOptions: OptionItem[] = [
  { id: "Single", name: "Single" },
  { id: "Married", name: "Married" },
  { id: "Widowed", name: "Widowed" },
  { id: "Separated", name: "Separated" },
  { id: "Divorced", name: "Divorced" },
  { id: "NA", name: "NA" },
];

export default function ManageMembers() {
  const router = useRouter();
  const optionsLoadPromiseRef = useRef<Promise<void> | null>(null);

  const [items, setItems] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedStatus, setSelectedStatus] = useState<MemberStatus>("unregister");
  const [selectedCivilStatus, setSelectedCivilStatus] = useState<string>("NA");
  const [selectedRole, setSelectedRole] = useState<MemberRole>("member");
  const [showPassword, setShowPassword] = useState(false);

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
      snap.docs.map((d) => {
        const data = d.data() as any;
        const firstName = String(data?.firstName ?? "").trim();
        const lastName = String(data?.lastName ?? "").trim();
        const fullName = String(data?.fullName ?? "").trim();
        const mergedName = fullName || [firstName, lastName].filter(Boolean).join(" ").trim();

        return {
          id: d.id,
          name: String(data?.name ?? ""),
          firstName,
          lastName,
          fullName: mergedName,
          password: String(data?.password ?? ""),
          contact: normalizeNA(data?.contact),
          civilStatus: normalizeNA(data?.civilStatus),
          ministry: normalizeArray(data?.ministry),
          coreGroup: normalizeArray(data?.coreGroup),
          status: normalizeStatus(data?.status),
          role: normalizeRole(data?.role),
          idx: typeof data?.idx === "number" ? data.idx : undefined,
        };
      })
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
    optionsLoadPromiseRef.current = loadOptions();
  }, []);

  const list = useMemo(() => {
    const q = search.toLowerCase().trim();

    const filtered = [...items].filter((x) =>
      `${x.name} ${x.firstName ?? ""} ${x.lastName ?? ""} ${x.fullName ?? ""} ${x.contact ?? ""} ${
        x.civilStatus ?? ""
      } ${x.ministry?.join(" ") ?? ""} ${x.coreGroup?.join(" ")} ${x.status ?? ""} ${x.role ?? ""} ${
        x.idx ?? ""
      }`
        .toLowerCase()
        .includes(q)
    );

    filtered.sort((a, b) => {
      if (sortField === "name") {
        const aDisplay = a.fullName || [a.firstName, a.lastName].filter(Boolean).join(" ") || a.name;
        const bDisplay = b.fullName || [b.firstName, b.lastName].filter(Boolean).join(" ") || b.name;
        const left = aDisplay.localeCompare(bDisplay);
        return sortDirection === "asc" ? left : -left;
      }

      const aIdx = typeof a.idx === "number" ? a.idx : Number.MAX_SAFE_INTEGER;
      const bIdx = typeof b.idx === "number" ? b.idx : Number.MAX_SAFE_INTEGER;
      if (aIdx !== bIdx) {
        return sortDirection === "asc" ? aIdx - bIdx : bIdx - aIdx;
      }

      const aDisplay = a.fullName || [a.firstName, a.lastName].filter(Boolean).join(" ") || a.name;
      const bDisplay = b.fullName || [b.firstName, b.lastName].filter(Boolean).join(" ") || b.name;
      const left = aDisplay.localeCompare(bDisplay);
      return sortDirection === "asc" ? left : -left;
    });

    return filtered;
  }, [items, search, sortField, sortDirection]);

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

  const sortLabel =
    sortField === "name"
      ? sortDirection === "asc"
        ? "A-Z"
        : "Z-A"
      : sortDirection === "asc"
        ? "Idx ↑"
        : "Idx ↓";

  const openAddMember = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedMinistries([]);
    setSelectedCoreGroups([]);
    setSelectedStatus("unregister");
    setSelectedCivilStatus("NA");
    setSelectedRole("member");
    setShowPassword(false);
    setFormOpen(true);
  };

  const openEditMember = (item: Member) => {
    const split =
      item.firstName || item.lastName
        ? {
            firstName: item.firstName ?? "",
            lastName: item.lastName ?? "",
          }
        : splitFullName(item.fullName || item.name);

    setEditingId(item.id);
    setForm({
      name: item.name ?? "",
      firstName: split.firstName,
      lastName: split.lastName,
      password: item.password ?? "",
      contact: item.contact && item.contact !== "NA" ? item.contact : "",
    });
    setSelectedMinistries(item.ministry ?? []);
    setSelectedCoreGroups(item.coreGroup ?? []);
    setSelectedStatus(item.status ?? "unregister");
    setSelectedCivilStatus(item.civilStatus && item.civilStatus !== "NA" ? item.civilStatus : "NA");
    setSelectedRole(item.role === "admin" ? "admin" : "member");
    setShowPassword(false);
    setFormOpen(true);
  };

  const openSelector = async (kind: ActiveSelector) => {
    if (
      kind !== "status" &&
      kind !== "civilStatus" &&
      kind !== "role" &&
      loadingOptions &&
      optionsLoadPromiseRef.current
    ) {
      await optionsLoadPromiseRef.current;
    }

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
      return;
    }

    if (kind === "status") {
      setSelectedStatus(value as MemberStatus);
      return;
    }

    if (kind === "civilStatus") {
      setSelectedCivilStatus(value);
      return;
    }

    if (kind === "role") {
      setSelectedRole(value as MemberRole);
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.firstName.trim() || !form.lastName.trim() || !form.password.trim()) {
      return Alert.alert("Error", "Name, First Name, Last Name, and Password are required");
    }

    setSaving(true);
    try {
      const mergedFullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();

      const data = {
        name: form.name.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        fullName: mergedFullName,
        password: form.password.trim(),
        contact: normalizeNA(form.contact),
        civilStatus: normalizeNA(selectedCivilStatus),
        ministry: selectedMinistries,
        coreGroup: selectedCoreGroups,
        status: selectedStatus,
        role: selectedRole,
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
      setSelectedStatus("unregister");
      setSelectedCivilStatus("NA");
      setSelectedRole("member");
      setShowPassword(false);
      await load();
    } catch {
      Alert.alert("Error", "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const activeOptions =
    activeSelector === "ministry"
      ? ministryOptions
      : activeSelector === "coreGroup"
        ? coreGroupOptions
        : activeSelector === "civilStatus"
          ? civilStatusOptions
          : activeSelector === "role"
            ? roleOptions
            : statusOptions;

  const activeTitle =
    activeSelector === "ministry"
      ? "Select Ministry"
      : activeSelector === "coreGroup"
        ? "Select Core Group"
        : activeSelector === "civilStatus"
          ? "Select Civil Status"
          : activeSelector === "role"
            ? "Select Role"
            : "Select Status";

  const activeSelected =
    activeSelector === "ministry"
      ? selectedMinistries
      : activeSelector === "coreGroup"
        ? selectedCoreGroups
        : activeSelector === "civilStatus"
          ? [selectedCivilStatus]
          : activeSelector === "role"
            ? [selectedRole]
            : [selectedStatus];

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="gap-3 px-5 pb-[110px] pt-5">
        <Text className="text-2xl font-extrabold text-slate-900">Manage Members</Text>

        <View className="h-[50px] flex-row items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-4">
          <MaterialIcons name="search" size={20} color="#6B7280" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search members"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 text-[15px] text-slate-900"
          />
        </View>

        <View className="flex-row items-center gap-2 self-start">
          <Pressable
            onPress={() => setSortOpen(true)}
            className="h-[46px] flex-row items-center gap-1.5 rounded-[14px] bg-slate-200 px-4"
            style={({ pressed }) =>
              pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
            }
          >
            <MaterialIcons name="sort" size={20} color="#111827" />
            <Text className="text-sm font-bold text-slate-900">{sortLabel}</Text>
            <MaterialIcons name="arrow-drop-down" size={22} color="#111827" />
          </Pressable>

          <Pressable
            onPress={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
            className="h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-slate-200"
            style={({ pressed }) =>
              pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
            }
          >
            <MaterialIcons
              name={sortDirection === "asc" ? "arrow-upward" : "arrow-downward"}
              size={22}
              color="#111827"
            />
          </Pressable>
        </View>

        <View className="gap-3">
          {list.map((item) => {
            const isOpen = openId === item.id;
            const dotColor = statusColor[item.status ?? "unregister"];
            const displayName =
              item.fullName?.trim() ||
              [item.firstName, item.lastName].filter(Boolean).join(" ").trim() ||
              item.name;

            return (
              <View
                key={item.id}
                className="overflow-hidden rounded-[18px] border border-slate-200 bg-white"
              >
                <View className="flex-row items-center gap-3 p-3.5">
                  <Pressable
                    onPress={() => toggleOpen(item.id)}
                    className="flex-1 flex-row items-center gap-3"
                    style={({ pressed }) =>
                      pressed ? { backgroundColor: "#F9FAFB" } : undefined
                    }
                  >
                    <View className="h-[46px] w-[46px] items-center justify-center rounded-full bg-slate-100">
                      <MaterialIcons name="person" size={24} color="#9CA3AF" />
                    </View>

                    <View className="h-3 w-3 rounded-full" style={{ backgroundColor: dotColor }} />

                    <Text className="flex-1 text-base font-bold text-slate-900">
                      {displayName}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => openEditMember(item)}
                    hitSlop={10}
                    className="items-center justify-center px-1"
                    style={({ pressed }) =>
                      pressed ? { opacity: 0.6, transform: [{ scale: 0.96 }] } : undefined
                    }
                  >
                    <MaterialIcons name="edit" size={20} color="#2563EB" />
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/task-board",
                        params: {
                          memberId: item.id,
                          memberName: displayName,
                          id: item.id,
                          name: displayName,
                          userRole: item.role ?? "member",
                        },
                      })
                    }
                    hitSlop={10}
                    className="items-center justify-center px-1"
                    style={({ pressed }) =>
                      pressed ? { opacity: 0.6, transform: [{ scale: 0.96 }] } : undefined
                    }
                  >
                    <MaterialIcons name="assignment" size={20} color="#7C3AED" />
                  </Pressable>

                  <Pressable
                    onPress={() => toggleOpen(item.id)}
                    hitSlop={10}
                    className="items-center justify-center px-1"
                    style={({ pressed }) =>
                      pressed ? { opacity: 0.6, transform: [{ scale: 0.96 }] } : undefined
                    }
                  >
                    <MaterialIcons
                      name={isOpen ? "expand-less" : "expand-more"}
                      size={24}
                      color="#6B7280"
                    />
                  </Pressable>
                </View>

                {isOpen ? (
                  <View className="gap-2.5 px-3.5 pb-3.5">
                    <DetailRow label="Name" value={item.name} />
                    <DetailRow label="First Name" value={item.firstName} />
                    <DetailRow label="Last Name" value={item.lastName} />
                    <DetailRow label="Full Name" value={item.fullName} />
                    <DetailRow label="Contact" value={item.contact} />
                    <DetailRow label="Civil Status" value={item.civilStatus} />
                    <DetailRow label="Status" value={statusLabel[item.status ?? "unregister"]} />
                    <DetailRow label="Ministry" value={formatList(item.ministry)} />
                    <DetailRow label="Core Group" value={formatList(item.coreGroup)} />

                    <View className="flex-row flex-wrap justify-end gap-2.5 pt-0.5">
                      <Pressable
                        onPress={() => remove(item.id)}
                        className="h-10 flex-row items-center gap-1.5 rounded-xl bg-red-600 px-3"
                        style={({ pressed }) =>
                          pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                        }
                      >
                        <MaterialIcons name="delete" size={18} color="#fff" />
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Pressable
        onPress={openAddMember}
        className="absolute bottom-5 right-5 h-[58px] w-[58px] items-center justify-center rounded-full bg-blue-600"
        style={({ pressed }) => [
          pressed
            ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
            : {
                shadowColor: "#000",
                shadowOpacity: 0.2,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              },
        ]}
      >
        <MaterialIcons name="person-add-alt-1" size={24} color="#fff" />
      </Pressable>

      <Modal
        visible={formOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFormOpen(false)}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setFormOpen(false)}>
          <Pressable
            className="max-h-[90%] rounded-t-[24px] bg-white px-[18px] pb-[18px] pt-2"
            onPress={() => {}}
          >
            <View className="mb-3 self-center h-[5px] w-[44px] rounded-full bg-slate-300" />
            <View className="mb-3 flex-row items-center justify-between gap-3">
              <Text className="flex-1 text-[22px] font-extrabold text-slate-900">
                {editingId ? "Edit Member" : "Add Member"}
              </Text>

              <Pressable
                onPress={() => openSelector("role")}
                className="flex-row items-center gap-2 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2"
                style={({ pressed }) =>
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                }
              >
                <Text className="text-[12px] font-extrabold uppercase tracking-[0.6px] text-slate-500">
                  Role:
                </Text>
                <Text className="text-[15px] font-bold text-slate-900">
                  {roleLabel[selectedRole]}
                </Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-3 pb-2">
              <TextInput
                value={form.name}
                onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
                placeholder="Nickname"
                autoCapitalize="words"
                autoCorrect={false}
                className="rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900"
              />

              <View className="flex-row gap-3">
                <TextInput
                  value={form.firstName}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, firstName: value }))}
                  placeholder="First Name"
                  autoCapitalize="words"
                  autoCorrect={false}
                  className="flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900"
                />

                <TextInput
                  value={form.lastName}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, lastName: value }))}
                  placeholder="Last Name"
                  autoCapitalize="words"
                  autoCorrect={false}
                  className="flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900"
                />
              </View>

              <View className="flex-row items-center rounded-[14px] border border-slate-200 bg-white px-4">
                <TextInput
                  value={form.password}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, password: value }))}
                  placeholder="Password"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 py-3 text-[15px] text-slate-900"
                />
                <Pressable
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={10}
                  className="pl-3"
                >
                  <MaterialIcons
                    name={showPassword ? "visibility-off" : "visibility"}
                    size={22}
                    color="#6B7280"
                  />
                </Pressable>
              </View>

              <TextInput
                value={form.contact}
                onChangeText={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    contact: value.replace(/[^0-9]/g, ""),
                  }))
                }
                placeholder="Contact"
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
                className="rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900"
              />

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => openSelector("civilStatus")}
                  className="flex-1 gap-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3"
                  style={({ pressed }) =>
                    pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                  }
                >
                  <Text className="text-xs font-bold uppercase text-slate-500">Civil Status</Text>
                  <Text className="text-[15px] font-bold text-slate-900">
                    {selectedCivilStatus}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => openSelector("status")}
                  className="flex-1 gap-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3"
                  style={({ pressed }) =>
                    pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                  }
                >
                  <Text className="text-xs font-bold uppercase text-slate-500">Status</Text>
                  <Text className="text-[15px] font-bold text-slate-900">
                    {statusLabel[selectedStatus]}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => openSelector("ministry")}
                className="gap-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3"
                style={({ pressed }) =>
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                }
              >
                <Text className="text-xs font-bold uppercase text-slate-500">Ministry</Text>
                <Text className="text-[15px] font-bold text-slate-900">
                  {selectedMinistries.length ? selectedMinistries.join(", ") : "NA"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => openSelector("coreGroup")}
                className="gap-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3"
                style={({ pressed }) =>
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                }
              >
                <Text className="text-xs font-bold uppercase text-slate-500">Core Group</Text>
                <Text className="text-[15px] font-bold text-slate-900">
                  {selectedCoreGroups.length ? selectedCoreGroups.join(", ") : "NA"}
                </Text>
              </Pressable>

              <View className="flex-row justify-end gap-2.5 pt-1">
                <Pressable
                  onPress={() => setFormOpen(false)}
                  className="rounded-[14px] bg-slate-200 px-4 py-3"
                  style={({ pressed }) =>
                    pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                  }
                >
                  <Text className="font-extrabold text-slate-900">Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={save}
                  disabled={saving}
                  className="rounded-[14px] bg-slate-900 px-4 py-3"
                  style={({ pressed }) => [
                    pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined,
                    saving ? { opacity: 0.7 } : undefined,
                  ]}
                >
                  <Text className="font-extrabold text-white">
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
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setSelectorOpen(false)}>
          <Pressable
            className="max-h-[90%] rounded-t-[24px] bg-white px-[18px] pb-[18px] pt-2"
            onPress={() => {}}
          >
            <View className="mb-3 self-center h-[5px] w-[44px] rounded-full bg-slate-300" />
            <Text className="mb-3 text-[22px] font-extrabold text-slate-900">{activeTitle}</Text>

            <ScrollView
              className="max-h-[430px]"
              contentContainerClassName="gap-2.5 pb-3"
              showsVerticalScrollIndicator={false}
            >
              {loadingOptions && (activeSelector === "ministry" || activeSelector === "coreGroup") ? (
                <View className="py-5">
                  <Text className="text-center text-slate-500">Loading...</Text>
                </View>
              ) : activeOptions.length === 0 ? (
                <Text className="py-5 text-center text-slate-500">No options available</Text>
              ) : (
                activeOptions.map((item) => {
                  const isStatus = activeSelector === "status";
                  const isCivilStatus = activeSelector === "civilStatus";
                  const isRole = activeSelector === "role";
                  const selected = isStatus
                    ? selectedStatus === item.id
                    : isCivilStatus
                      ? selectedCivilStatus === item.name
                      : isRole
                        ? selectedRole === item.id
                        : activeSelected.includes(item.name);

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        toggleSelected(
                          isStatus || isCivilStatus || isRole ? item.id : item.name,
                          activeSelector
                        )
                      }
                      className={`min-h-[48px] flex-row items-center gap-3 rounded-[14px] px-4 ${
                        selected ? "bg-blue-50" : "bg-slate-50"
                      }`}
                      style={({ pressed }) =>
                        pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                      }
                    >
                      <View className="h-[22px] w-[22px] items-center justify-center rounded-md border border-slate-400 bg-white">
                        {selected ? (
                          <Text className="text-sm font-extrabold text-emerald-600">✓</Text>
                        ) : null}
                      </View>
                      <Text className="flex-1 text-[15px] font-bold text-slate-900">
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <Pressable
              onPress={() => setSelectorOpen(false)}
              className="mt-3 self-end rounded-[14px] bg-slate-200 px-4 py-3"
              style={({ pressed }) =>
                pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
              }
            >
              <Text className="font-extrabold text-slate-900">Close</Text>
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
        <Pressable className="flex-1 bg-black/20 pt-[180px] pl-5" onPress={() => setSortOpen(false)}>
          <Pressable
            className="w-[170px] overflow-hidden rounded-2xl border border-slate-200 bg-white"
            onPress={() => {}}
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.14,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            <Text className="px-4 pb-2 pt-4 text-[13px] font-extrabold text-slate-900">
              Sort by
            </Text>

            <Pressable
              onPress={() => {
                setSortField("name");
                setSortOpen(false);
              }}
              className={`min-h-[48px] flex-row items-center justify-between rounded-[14px] px-4 ${
                sortField === "name" ? "bg-blue-50" : "bg-slate-50"
              }`}
              style={({ pressed }) =>
                pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
              }
            >
              <Text className="text-[15px] font-bold text-slate-900">A-Z</Text>
              {sortField === "name" ? <MaterialIcons name="check" size={18} color="#2563EB" /> : null}
            </Pressable>

            <Pressable
              onPress={() => {
                setSortField("idx");
                setSortOpen(false);
              }}
              className={`min-h-[48px] flex-row items-center justify-between rounded-[14px] px-4 ${
                sortField === "idx" ? "bg-blue-50" : "bg-slate-50"
              }`}
              style={({ pressed }) =>
                pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
              }
            >
              <Text className="text-[15px] font-bold text-slate-900">Idx</Text>
              {sortField === "idx" ? <MaterialIcons name="check" size={18} color="#2563EB" /> : null}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function formatList(items?: string[]) {
  if (!items || items.length === 0) return "NA";
  if (items.length <= 2) return items.join(", ");
  return `${items.slice(0, 2).join(", ")} +${items.length - 2}`;
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;

  return (
    <View className="gap-1 rounded-[12px] bg-slate-50 p-3">
      <Text className="text-xs font-semibold uppercase tracking-[0.4px] text-slate-500">
        {label}
      </Text>
      <Text className="text-[15px] font-semibold text-slate-900">{value}</Text>
    </View>
  );
}