import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
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
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { db } from "../../lib/firebaseConfig";
import ManageMemberModal, {
  ActionMenuState,
  ActiveSelector,
  MemberFormState,
  MemberRecord,
  MemberRole,
  MemberStatus,
  OptionItem,
  SortDirection,
  SortField,
  emptyMemberForm,
  normalizeNA,
  normalizeRole,
  normalizeStatus,
  normalizeTimestamp,
  splitFullName,
  statusColor,
} from "./manage-members-modal";

export default function ManageMembers() {
  const router = useRouter();
  const window = useWindowDimensions();
  const optionsLoadPromiseRef = useRef<Promise<void> | null>(null);
  const actionButtonRefs = useRef<Record<string, View | null>>({});

  const [items, setItems] = useState<MemberRecord[]>([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [openId, setOpenId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberFormState>(emptyMemberForm);
  const [selectedStatus, setSelectedStatus] = useState<MemberStatus>("unregister");
  const [selectedCivilStatus, setSelectedCivilStatus] = useState<string>("NA");
  const [selectedRole, setSelectedRole] = useState<MemberRole>("member");
  const [selectedStartedAt, setSelectedStartedAt] = useState<number>(Date.now());
  const [showPassword, setShowPassword] = useState(false);
  const [originalStatus, setOriginalStatus] = useState<MemberStatus>("unregister");

  const [ministryOptions, setMinistryOptions] = useState<OptionItem[]>([]);
  const [coreGroupOptions, setCoreGroupOptions] = useState<OptionItem[]>([]);
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
  const [selectedCoreGroups, setSelectedCoreGroups] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [activeSelector, setActiveSelector] = useState<ActiveSelector>(null);

  const [actionMenu, setActionMenu] = useState<ActionMenuState>({
    visible: false,
    item: null,
    top: 0,
    left: 0,
  });

  const [sortOpen, setSortOpen] = useState(false);
  const [showStartedDatePicker, setShowStartedDatePicker] = useState(false);

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
          ministry: Array.isArray(data?.ministry)
            ? data.ministry.map((x: unknown) => String(x).trim()).filter(Boolean)
            : typeof data?.ministry === "string" && String(data.ministry).trim()
              ? [String(data.ministry).trim()]
              : [],
          coreGroup: Array.isArray(data?.coreGroup)
            ? data.coreGroup.map((x: unknown) => String(x).trim()).filter(Boolean)
            : typeof data?.coreGroup === "string" && String(data.coreGroup).trim()
              ? [String(data.coreGroup).trim()]
              : [],
          status: normalizeStatus(data?.status),
          role: normalizeRole(data?.role),
          idx: typeof data?.idx === "number" ? data.idx : undefined,
          startedAt: normalizeTimestamp(data?.startedAt),
          statusChangedAt: normalizeTimestamp(data?.statusChangedAt),
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
      } ${x.startedAt ?? ""} ${x.statusChangedAt ?? ""}`
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
    setForm(emptyMemberForm);
    setSelectedMinistries([]);
    setSelectedCoreGroups([]);
    setSelectedStatus("unregister");
    setSelectedCivilStatus("NA");
    setSelectedRole("member");
    setSelectedStartedAt(Date.now());
    setOriginalStatus("unregister");
    setShowPassword(false);
    setShowStartedDatePicker(false);
    setFormOpen(true);
  };

  const openEditMember = (item: MemberRecord) => {
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
    setOriginalStatus(item.status ?? "unregister");
    setSelectedCivilStatus(item.civilStatus && item.civilStatus !== "NA" ? item.civilStatus : "NA");
    setSelectedRole(item.role === "admin" ? "admin" : "member");
    setSelectedStartedAt(typeof item.startedAt === "number" ? item.startedAt : Date.now());
    setShowPassword(false);
    setShowStartedDatePicker(false);
    setFormOpen(true);
  };

  const openTask = (item: MemberRecord) => {
    const displayName =
      item.fullName?.trim() || [item.firstName, item.lastName].filter(Boolean).join(" ").trim() || item.name;

    router.push({
      pathname: "/task-board",
      params: {
        memberId: item.id,
        memberName: displayName,
        id: item.id,
        name: displayName,
        userRole: item.role ?? "member",
      },
    });
  };

  const closeActionMenu = () => {
    setActionMenu({
      visible: false,
      item: null,
      top: 0,
      left: 0,
    });
  };

  const openActionMenu = (item: MemberRecord, id: string) => {
    const node = actionButtonRefs.current[id];

    if (node && typeof node.measureInWindow === "function") {
      node.measureInWindow((x, y, width, height) => {
        const menuWidth = 176;
        const menuHeight = 156;
        const gap = 8;

        const left = Math.max(8, x - menuWidth - gap);
        const centeredTop = y + height / 2 - menuHeight / 2;
        const top = Math.min(
          Math.max(8, centeredTop),
          Math.max(8, window.height - menuHeight - 8)
        );

        setActionMenu({
          visible: true,
          item,
          top,
          left,
        });
      });
      return;
    }

    setActionMenu({
      visible: true,
      item,
      top: Math.max(8, window.height / 2 - 78),
      left: Math.max(8, window.width - 184),
    });
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

  const save = async () => {
    if (!form.name.trim() || !form.firstName.trim() || !form.lastName.trim() || !form.password.trim()) {
      return Alert.alert("Error", "Name, First Name, Last Name, and Password are required");
    }

    setSaving(true);
    try {
      const mergedFullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
      const currentItem = editingId ? items.find((x) => x.id === editingId) : null;
      const statusChangedAt =
        editingId && selectedStatus === originalStatus
          ? currentItem?.statusChangedAt ?? null
          : Date.now();

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
        startedAt: selectedStartedAt,
        statusChangedAt,
      };

      if (editingId) {
        await updateDoc(doc(db, "users", editingId), data);
      } else {
        await addDoc(collection(db, "users"), data);
      }

      setFormOpen(false);
      setEditingId(null);
      setForm(emptyMemberForm);
      setSelectedMinistries([]);
      setSelectedCoreGroups([]);
      setSelectedStatus("unregister");
      setSelectedCivilStatus("NA");
      setSelectedRole("member");
      setSelectedStartedAt(Date.now());
      setOriginalStatus("unregister");
      setShowPassword(false);
      setShowStartedDatePicker(false);
      await load();
    } catch {
      Alert.alert("Error", "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="gap-3 px-5 pb-[110px] pt-5">
        <Text className="text-2xl font-extrabold text-slate-900">Manage Members</Text>

        <ManageMemberModal
          formOpen={formOpen}
          setFormOpen={setFormOpen}
          selectorOpen={selectorOpen}
          setSelectorOpen={setSelectorOpen}
          activeSelector={activeSelector}
          setActiveSelector={setActiveSelector}
          sortOpen={sortOpen}
          setSortOpen={setSortOpen}
          actionMenu={actionMenu}
          onCloseActionMenu={closeActionMenu}
          onEditItem={openEditMember}
          onTaskItem={openTask}
          editingId={editingId}
          form={form}
          setForm={setForm}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          selectedCivilStatus={selectedCivilStatus}
          setSelectedCivilStatus={setSelectedCivilStatus}
          selectedRole={selectedRole}
          setSelectedRole={setSelectedRole}
          selectedStartedAt={selectedStartedAt}
          setSelectedStartedAt={setSelectedStartedAt}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          showStartedDatePicker={showStartedDatePicker}
          setShowStartedDatePicker={setShowStartedDatePicker}
          selectedMinistries={selectedMinistries}
          setSelectedMinistries={setSelectedMinistries}
          selectedCoreGroups={selectedCoreGroups}
          setSelectedCoreGroups={setSelectedCoreGroups}
          ministryOptions={ministryOptions}
          coreGroupOptions={coreGroupOptions}
          loadingOptions={loadingOptions}
          saving={saving}
          onSave={save}
          sortField={sortField}
          setSortField={setSortField}
          sortDirection={sortDirection}
          setSortDirection={setSortDirection}
          onOpenSelector={openSelector}
          openAddMember={openAddMember}
        />

        <TextInputSearch value={search} onChangeText={setSearch} />

        <View className="flex-row items-center gap-2 self-start">
          <Pressable
            onPress={toggleSortDirection}
            className="h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-slate-200"
            style={({ pressed }) =>
              pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
            }
          >
            <MaterialCommunityIcons
              name={sortDirection === "asc" ? "sort-ascending" : "sort-descending"}
              size={22}
              color="#111827"
            />
          </Pressable>

          <Pressable
            onPress={() => setSortOpen(true)}
            className="h-[46px] flex-row items-center gap-1.5 rounded-[14px] bg-slate-200 px-4"
            style={({ pressed }) =>
              pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
            }
          >
            <Text className="text-sm font-bold text-slate-900">{sortLabel}</Text>
            <MaterialIcons name="arrow-drop-down" size={22} color="#111827" />
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

                    <Text className="flex-1 text-base font-bold text-slate-900">{displayName}</Text>
                  </Pressable>

                  <View
                    ref={(node) => {
                      actionButtonRefs.current[item.id] = node;
                    }}
                    collapsable={false}
                  >
                    <Pressable
                      onPress={() => openActionMenu(item, item.id)}
                      hitSlop={10}
                      className="items-center justify-center px-1"
                      style={({ pressed }) =>
                        pressed ? { opacity: 0.6, transform: [{ scale: 0.96 }] } : undefined
                      }
                    >
                      <MaterialIcons name="more-vert" size={24} color="#374151" />
                    </Pressable>
                  </View>

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
                    <DetailRow label="Status" value={item.status ? item.status : "unregister"} />
                    <DetailRow label="Member Started" value={formatTimestamp(item.startedAt)} />
                    <DetailRow label="Status Changed At" value={formatTimestamp(item.statusChangedAt)} />
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
    </View>
  );
}

function TextInputSearch({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View className="rounded-[14px] border border-slate-200 bg-white px-4 py-3">
      <Text className="mb-1 text-xs font-bold uppercase text-slate-500">Search members</Text>
      <View className="flex-row items-center gap-2 rounded-[12px] bg-slate-50 px-3 py-2">
        <MaterialIcons name="search" size={20} color="#6B7280" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Type to search"
          placeholderTextColor="#94A3B8"
          className="flex-1 text-[15px] text-slate-900"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>
    </View>
  );
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

function formatList(items?: string[]) {
  if (!items || items.length === 0) return "NA";
  if (items.length <= 2) return items.join(", ");
  return `${items.slice(0, 2).join(", ")} +${items.length - 2}`;
}

function formatTimestamp(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "NA";
  return new Date(value).toLocaleString();
}