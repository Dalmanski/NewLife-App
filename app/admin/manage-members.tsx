import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import { db } from "../../lib/firebaseConfig";
import ManageMemberModal, {
  ActionMenuState,
  ActiveSelector,
  Gender,
  MemberFormState,
  MemberRecord,
  MemberRole,
  MemberStatus,
  OptionItem,
  SortDirection,
  SortField,
  SocialLinkItem,
  TagItem,
  emptyMemberForm,
  genderLabel,
  normalizeGender,
  normalizeMinistryColorTag,
  normalizeNA,
  normalizeRole,
  normalizeSocialLinks,
  normalizeStatus,
  normalizeTags,
  normalizeTimestamp,
  splitFullName,
  statusColor,
  statusLabel,
} from "./manage-members-modal";

type StatusFilter = "all" | MemberStatus;

const CARE_GROUP_MINISTRY = "Care Group";
const PLACEHOLDER_PFP_MALE = require("../../assets/images/placeholder-pfp.avif");
const PLACEHOLDER_PFP_FEMALE = require("../../assets/images/placeholder-pfp-female.jpg");
const PLACEHOLDER_PFP_UNKNOWN = require("../../assets/images/placeholder-pfp-unknown.jpg");

const FALLBACK_TAG_COLOR = "#64748B";

export default function ManageMembers() {
  const router = useRouter();
  const window = useWindowDimensions();
  const isPortrait = window.height > window.width;
  const optionsLoadPromiseRef = useRef<Promise<void> | null>(null);
  const actionButtonRefs = useRef<Record<string, View | null>>({});

  const [items, setItems] = useState<MemberRecord[]>([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberFormState>(emptyMemberForm);
  const [selectedStatus, setSelectedStatus] = useState<MemberStatus>("unregister");
  const [selectedCivilStatus, setSelectedCivilStatus] = useState<string>("NA");
  const [selectedRole, setSelectedRole] = useState<MemberRole>("member");
  const [selectedGender, setSelectedGender] = useState<Gender>("NA");
  const [selectedStartedAt, setSelectedStartedAt] = useState<number>(Date.now());
  const [showPassword, setShowPassword] = useState(false);
  const [originalStatus, setOriginalStatus] = useState<MemberStatus>("unregister");

  const [ministryOptions, setMinistryOptions] = useState<OptionItem[]>([]);
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);

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

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MemberRecord | null>(null);

  const [statusChangeOpen, setStatusChangeOpen] = useState(false);
  const [statusChangeTarget, setStatusChangeTarget] = useState<MemberRecord | null>(null);

  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registerTarget, setRegisterTarget] = useState<MemberRecord | null>(null);
  const [registerSelectedMinistries, setRegisterSelectedMinistries] = useState<string[]>([]);
  const [registerDropdownOpen, setRegisterDropdownOpen] = useState(false);
  const [registerSavingId, setRegisterSavingId] = useState<string | null>(null);
  const [registerCareGroupSaving, setRegisterCareGroupSaving] = useState(false);
  const [registerCareGroupSaved, setRegisterCareGroupSaved] = useState(false);

  const ministryColorMap = useMemo(() => {
    const map = new Map<string, string>();
    ministryOptions.forEach((option) => {
      const key = String(option.name ?? "").trim().toLowerCase();
      if (!key) return;
      const colorHex = normalizeMinistryColorTag(option.colorTag ?? "gray");
      map.set(key, colorHex ?? FALLBACK_TAG_COLOR);
    });
    return map;
  }, [ministryOptions]);

  const buildAutoTags = useCallback(
    (ministries: string[]) => {
      const seen = new Set<string>();
      const result: TagItem[] = [];

      (ministries ?? [])
        .map((name) => String(name ?? "").trim())
        .filter(Boolean)
        .forEach((name) => {
          const key = name.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);

          result.push({
            name,
            color: ministryColorMap.get(key) ?? FALLBACK_TAG_COLOR,
          });
        });

      return result;
    },
    [ministryColorMap]
  );

  const buildMemberTags = useCallback(
    (ministries: string[], manualTags: TagItem[] = []) => {
      const autoTags = buildAutoTags(ministries);
      const seen = new Set(autoTags.map((tag) => tag.name.trim().toLowerCase()));

      const normalizedManual = normalizeTags(manualTags).filter((tag) => {
        const key = tag.name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return [...autoTags, ...normalizedManual];
    },
    [buildAutoTags]
  );

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
          gender: normalizeGender(data?.gender),
          ministry: Array.isArray(data?.ministry)
            ? data.ministry.map((x: unknown) => String(x).trim()).filter(Boolean)
            : typeof data?.ministry === "string" && String(data.ministry).trim()
              ? [String(data.ministry).trim()]
              : [],
          status: normalizeStatus(data?.status),
          role: normalizeRole(data?.role),
          idx: typeof data?.idx === "number" ? data.idx : undefined,
          startedAt: normalizeTimestamp(data?.startedAt),
          statusChangedAt: normalizeTimestamp(data?.statusChangedAt),
          tags: normalizeTags(data?.tags),
          socialLinks: normalizeSocialLinks(data?.socialLinks ?? data?.socials ?? data?.links ?? []),
        };
      })
    );
  };

  const loadOptions = async () => {
    setLoadingOptions(true);
    try {
      const ministrySnap = await getDocs(collection(db, "ministries"));

      const ministries = ministrySnap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: String(data?.name ?? "").trim(),
            colorTag: normalizeMinistryColorTag(data?.colorTag ?? data?.tagColor ?? "gray"),
          };
        })
        .filter((x) => x.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      setMinistryOptions(ministries);
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

  const sortLabel =
    sortField === "name"
      ? sortDirection === "asc"
        ? "A-Z"
        : "Z-A"
      : sortDirection === "asc"
        ? "Idx ↑"
        : "Idx ↓";

  const list = useMemo(() => {
    const q = search.toLowerCase().trim();

    const filtered = [...items]
      .filter((x) => statusFilter === "all" || x.status === statusFilter)
      .filter((x) =>
        `${x.name} ${x.firstName ?? ""} ${x.lastName ?? ""} ${x.fullName ?? ""} ${x.contact ?? ""} ${
          x.civilStatus ?? ""
        } ${x.gender ?? ""} ${x.ministry?.join(" ") ?? ""} ${x.tags?.map((t) => t.name).join(" ") ?? ""} ${
          x.socialLinks?.map((l) => l.url).join(" ") ?? ""
        } ${x.status ?? ""} ${x.role ?? ""} ${x.idx ?? ""} ${x.startedAt ?? ""} ${
          x.statusChangedAt ?? ""
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
  }, [items, search, sortField, sortDirection, statusFilter]);

  const requestDelete = (item: MemberRecord) => {
    setDeleteTarget(item);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteDoc(doc(db, "users", deleteTarget.id));
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      await load();
    } catch {
      Alert.alert("Error", "Delete failed");
    }
  };

  const requestStatusChange = (item: MemberRecord) => {
    setStatusChangeTarget(item);
    setStatusChangeOpen(true);
  };

  const confirmStatusChange = async (status: MemberStatus) => {
    if (!statusChangeTarget) return;

    try {
      await updateDoc(doc(db, "users", statusChangeTarget.id), {
        status,
        statusChangedAt: Date.now(),
      });
      setStatusChangeOpen(false);
      setStatusChangeTarget(null);
      await load();
    } catch {
      Alert.alert("Error", "Failed to update status");
    }
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
      socialLinks: item.socialLinks?.length
        ? item.socialLinks.map((link: SocialLinkItem) => link.url).filter(Boolean)
        : [""],
      profileImageUrl: (item as any)?.profileImageUrl ?? "",
    });
    setSelectedMinistries(item.ministry ?? []);
    setSelectedTags(item.tags ?? []);
    setSelectedStatus(item.status ?? "unregister");
    setOriginalStatus(item.status ?? "unregister");
    setSelectedCivilStatus(item.civilStatus && item.civilStatus !== "NA" ? item.civilStatus : "NA");
    setSelectedRole(item.role === "admin" ? "admin" : "member");
    setSelectedGender(item.gender ?? "NA");
    setSelectedStartedAt(typeof item.startedAt === "number" ? item.startedAt : Date.now());
    setShowPassword(false);
    setShowStartedDatePicker(false);
    setFormOpen(true);
  };

  const openMember = (item: MemberRecord) => {
    const displayName =
      item.fullName?.trim() || [item.firstName, item.lastName].filter(Boolean).join(" ").trim() || item.name;

    router.push({
      pathname: "/admin/member",
      params: {
        memberId: item.id,
        memberName: displayName,
        id: item.id,
        name: displayName,
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
        const top = Math.min(Math.max(8, centeredTop), Math.max(8, window.height - menuHeight - 8));

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
      kind !== "gender" &&
      loadingOptions &&
      optionsLoadPromiseRef.current
    ) {
      await optionsLoadPromiseRef.current;
    }

    setActiveSelector(kind);
    setSelectorOpen(true);
  };

  const openAddMember = () => {
    setEditingId(null);
    setForm(emptyMemberForm);
    setSelectedMinistries([]);
    setSelectedTags([]);
    setSelectedStatus("unregister");
    setSelectedCivilStatus("NA");
    setSelectedRole("member");
    setSelectedGender("NA");
    setSelectedStartedAt(Date.now());
    setOriginalStatus("unregister");
    setShowPassword(false);
    setShowStartedDatePicker(false);
    setFormOpen(true);
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

      const tags = buildMemberTags(selectedMinistries, selectedTags);
      const socialLinks = normalizeSocialLinks(form.socialLinks ?? []);

      const data = {
        name: form.name.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        fullName: mergedFullName,
        password: form.password.trim(),
        contact: normalizeNA(form.contact),
        civilStatus: normalizeNA(selectedCivilStatus),
        gender: selectedGender,
        ministry: selectedMinistries,
        status: selectedStatus,
        role: selectedRole,
        startedAt: selectedStartedAt,
        statusChangedAt,
        tags,
        socialLinks,
        profileImageUrl: form.profileImageUrl || "",
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
      setSelectedTags([]);
      setSelectedStatus("unregister");
      setSelectedCivilStatus("NA");
      setSelectedRole("member");
      setSelectedGender("NA");
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

  const openRegisterModal = async (item: MemberRecord) => {
    if (loadingOptions && optionsLoadPromiseRef.current) {
      await optionsLoadPromiseRef.current;
    }

    const ministries = Array.isArray(item.ministry) ? item.ministry.filter(Boolean) : [];
    const withoutCareGroup = ministries.filter((x) => x !== CARE_GROUP_MINISTRY);

    setRegisterTarget(item);
    setRegisterSelectedMinistries(withoutCareGroup);
    setRegisterDropdownOpen(false);
    setRegisterCareGroupSaved(ministries.includes(CARE_GROUP_MINISTRY));
    setRegisterModalOpen(true);
  };

  const closeRegisterModal = () => {
    setRegisterModalOpen(false);
    setRegisterTarget(null);
    setRegisterSelectedMinistries([]);
    setRegisterDropdownOpen(false);
    setRegisterCareGroupSaved(false);
  };

  const toggleRegisterMinistry = (name: string) => {
    setRegisterSelectedMinistries((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  };

  const saveCareGroupImmediately = async () => {
    if (!registerTarget) return;

    if (registerCareGroupSaved) {
      Alert.alert("Care Group", "Care Group is already saved for this member");
      return;
    }

    setRegisterCareGroupSaving(true);
    try {
      const currentMinistries = Array.isArray(registerTarget.ministry)
        ? registerTarget.ministry.filter(Boolean)
        : [];
      const nextMinistries = Array.from(
        new Set([...currentMinistries, CARE_GROUP_MINISTRY].map((x) => String(x).trim()).filter(Boolean))
      );
      const nextTags = buildMemberTags(nextMinistries, registerTarget.tags ?? []);

      await updateDoc(doc(db, "users", registerTarget.id), {
        ministry: nextMinistries,
        tags: nextTags,
      });

      const ministrySnap = await getDocs(collection(db, "ministries"));
      const careGroupDoc = ministrySnap.docs.find(
        (d) => String((d.data() as any)?.name ?? "").trim().toLowerCase() === CARE_GROUP_MINISTRY.toLowerCase()
      );

      if (careGroupDoc) {
        const ministryData = careGroupDoc.data() as any;
        const existingMembers = Array.isArray(ministryData?.members)
          ? ministryData.members
          : ministryData?.memberId
            ? [ministryData.memberId]
            : [];
        const updatedMembers = Array.from(new Set([...existingMembers, registerTarget.id]));

        const updateData: any = { members: updatedMembers };
        if (ministryData?.memberId) {
          updateData.memberId = deleteField();
        }

        await updateDoc(doc(db, "ministries", careGroupDoc.id), updateData);
      }

      setRegisterCareGroupSaved(true);

      setItems((prev) =>
        prev.map((x) =>
          x.id === registerTarget.id
            ? {
                ...x,
                ministry: nextMinistries,
                tags: nextTags,
              }
            : x
        )
      );

      closeRegisterModal();
    } catch {
      Alert.alert("Error", "Failed to save Care Group ministry");
    } finally {
      setRegisterCareGroupSaving(false);
    }
  };

  const confirmRegister = async () => {
    if (!registerTarget) return;

    const ministries = registerSelectedMinistries.map((x) => String(x).trim()).filter(Boolean);

    setRegisterSavingId(registerTarget.id);
    try {
      const currentMinistries = Array.isArray(registerTarget.ministry)
        ? registerTarget.ministry.filter(Boolean)
        : [];
      const hasCareGroup = registerCareGroupSaved || currentMinistries.includes(CARE_GROUP_MINISTRY);

      const nextMinistries = Array.from(
        new Set([...ministries, ...(hasCareGroup ? [CARE_GROUP_MINISTRY] : [])].map((x) => String(x).trim()))
      ).filter(Boolean);

      const nextTags = buildMemberTags(nextMinistries, registerTarget.tags ?? []);

      await updateDoc(doc(db, "users", registerTarget.id), {
        status: "register",
        statusChangedAt: Date.now(),
        ministry: nextMinistries,
        tags: nextTags,
      });

      const ministrySnap = await getDocs(collection(db, "ministries"));
      for (const ministryName of nextMinistries) {
        const ministryDoc = ministrySnap.docs.find(
          (d) =>
            String((d.data() as any)?.name ?? "").trim().toLowerCase() ===
            String(ministryName).trim().toLowerCase()
        );

        if (ministryDoc) {
          const ministryData = ministryDoc.data() as any;
          const existingMembers = Array.isArray(ministryData?.members)
            ? ministryData.members
            : ministryData?.memberId
              ? [ministryData.memberId]
              : [];
          const updatedMembers = Array.from(new Set([...existingMembers, registerTarget.id]));

          const updateData: any = { members: updatedMembers };
          if (ministryData?.memberId) {
            updateData.memberId = deleteField();
          }

          await updateDoc(doc(db, "ministries", ministryDoc.id), updateData);
        }
      }

      closeRegisterModal();
      await load();
    } catch {
      Alert.alert("Error", "Failed to register member");
    } finally {
      setRegisterSavingId(null);
    }
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
          onTaskItem={openMember}
          editingId={editingId}
          form={form}
          setForm={setForm}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          selectedCivilStatus={selectedCivilStatus}
          setSelectedCivilStatus={setSelectedCivilStatus}
          selectedRole={selectedRole}
          setSelectedRole={setSelectedRole}
          selectedGender={selectedGender}
          setSelectedGender={setSelectedGender}
          selectedStartedAt={selectedStartedAt}
          setSelectedStartedAt={setSelectedStartedAt}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          showStartedDatePicker={showStartedDatePicker}
          setShowStartedDatePicker={setShowStartedDatePicker}
          selectedMinistries={selectedMinistries}
          setSelectedMinistries={setSelectedMinistries}
          ministryOptions={ministryOptions}
          loadingOptions={loadingOptions}
          saving={saving}
          onSave={save}
          sortField={sortField}
          setSortField={setSortField}
          sortDirection={sortDirection}
          setSortDirection={setSortDirection}
          onOpenSelector={openSelector}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
          deleteConfirmOpen={deleteConfirmOpen}
          setDeleteConfirmOpen={setDeleteConfirmOpen}
          deleteTarget={deleteTarget}
          onConfirmDelete={confirmDelete}
          onRequestDelete={requestDelete}
          statusChangeOpen={statusChangeOpen}
          setStatusChangeOpen={setStatusChangeOpen}
          statusChangeTarget={statusChangeTarget}
          onConfirmStatusChange={confirmStatusChange}
        />

        <View className="flex-row flex-nowrap items-center gap-2">
          <View className="flex-row items-center gap-2 shrink-0">
            <Pressable
              onPress={toggleSortDirection}
              className="h-[44px] w-[44px] items-center justify-center rounded-[14px] bg-slate-200"
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
              className="h-[44px] flex-row items-center gap-1.5 rounded-[14px] bg-slate-200 px-3.5"
              style={({ pressed }) =>
                pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
              }
            >
              <Text className="text-[13px] font-bold text-slate-900">{sortLabel}</Text>
              <MaterialIcons name="arrow-drop-down" size={22} color="#111827" />
            </Pressable>
          </View>

          <View
            className={`min-w-0 flex-row flex-nowrap items-center gap-2 overflow-hidden ${
              isPortrait ? "flex-1 justify-start" : "flex-1"
            }`}
          >
            {["all", "unregister", "pending", "register"].map((value) => {
              const isActive = statusFilter === value;
              const label = value === "all" ? "All" : statusLabel[value as MemberStatus];

              return (
                <Pressable
                  key={value}
                  onPress={() => setStatusFilter(value as StatusFilter)}
                  className={`shrink-0 rounded-full px-3 py-2 ${
                    isActive ? "bg-slate-900" : "bg-slate-200"
                  }`}
                  style={({ pressed }) =>
                    pressed ? { opacity: 0.88, transform: [{ scale: 0.98 }] } : undefined
                  }
                >
                  <Text
                    className={`text-[12px] font-extrabold ${
                      isActive ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={openAddMember}
            className="ml-auto h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px] bg-emerald-600"
            style={({ pressed }) =>
              pressed ? { opacity: 0.88, transform: [{ scale: 0.98 }] } : undefined
            }
          >
            <MaterialIcons name="person-add-alt-1" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View className="rounded-[14px] border border-slate-200 bg-white px-3 py-2">
          <PaperTextInput
            mode="outlined"
            value={search}
            onChangeText={setSearch}
            placeholder="Type to search members"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            left={<PaperTextInput.Icon icon="magnify" />}
            outlineColor="#E2E8F0"
            activeOutlineColor="#0F172A"
            textColor="#0F172A"
            placeholderTextColor="#94A3B8"
            dense
            style={{
              backgroundColor: "#FFFFFF",
            }}
            theme={{
              roundness: 14,
              colors: {
                primary: "#0F172A",
                outline: "#E2E8F0",
                background: "#FFFFFF",
              },
            }}
          />
        </View>

        <View className="gap-3">
          {list.map((item) => {
            const isUnregister = item.status === "unregister";
            const dotColor = statusColor[item.status ?? "unregister"];
            const displayName =
              item.fullName?.trim() ||
              [item.firstName, item.lastName].filter(Boolean).join(" ").trim() ||
              item.name;

            const placeholderPfp =
              item.gender === "female"
                ? PLACEHOLDER_PFP_FEMALE
                : item.gender === "male"
                  ? PLACEHOLDER_PFP_MALE
                  : PLACEHOLDER_PFP_UNKNOWN;

            const displayTags = buildMemberTags(item.ministry ?? [], item.tags ?? []);

            return (
              <View
                key={item.id}
                className="overflow-hidden rounded-[18px] border border-slate-200 bg-white"
              >
                <View className="flex-row items-center gap-3 p-3.5">
                  <Pressable
                    onPress={() => requestStatusChange(item)}
                    hitSlop={10}
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor: dotColor,
                    }}
                  />

                  <Pressable
                    onPress={() => openMember(item)}
                    className="flex-1 flex-row items-center gap-3"
                    style={({ pressed }) =>
                      pressed ? { backgroundColor: "#F9FAFB" } : undefined
                    }
                  >
                    <View className="h-[46px] w-[46px] overflow-hidden rounded-full bg-slate-100">
                      <Image
                        source={placeholderPfp}
                        resizeMode="cover"
                        style={{ width: "100%", height: "100%" }}
                      />
                    </View>

                    <View className="flex-1 gap-1">
                      <View className="flex-row flex-wrap items-center gap-1.5">
                        <Text className="text-base font-bold text-slate-900">{displayName}</Text>
                        {displayTags.length ? (
                          <View className="flex-row flex-wrap gap-1.5">
                            {displayTags.map((tag, index) => (
                              <View
                                key={`${item.id}-tag-${index}-${tag.name}`}
                                className="rounded-full px-2.5 py-1"
                                style={{
                                  backgroundColor: `${tag.color || FALLBACK_TAG_COLOR}20`,
                                  borderWidth: 1,
                                  borderColor: tag.color || FALLBACK_TAG_COLOR,
                                }}
                              >
                                <Text
                                  className="text-[11px] font-bold"
                                  style={{ color: tag.color || FALLBACK_TAG_COLOR }}
                                >
                                  {tag.name}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>

                      <Text className="text-[12px] font-semibold text-slate-500">
                        {statusLabel[item.status ?? "unregister"]}
                      </Text>
                    </View>
                  </Pressable>

                  {isUnregister ? (
                    <Pressable
                      onPress={() => openRegisterModal(item)}
                      className="rounded-[14px] bg-emerald-600 px-4 py-2.5"
                      style={({ pressed }) =>
                        pressed ? { opacity: 0.88, transform: [{ scale: 0.98 }] } : undefined
                      }
                    >
                      <Text className="text-[12px] font-extrabold text-white">Register</Text>
                    </Pressable>
                  ) : null}

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
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        visible={registerModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeRegisterModal}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-5 py-6"
          onPress={closeRegisterModal}
        >
          <Pressable
            className="w-full max-w-[460px] rounded-[24px] bg-white px-[18px] pb-[18px] pt-2"
            onPress={() => {}}
          >
            <View className="mb-3 self-center h-[5px] w-[44px] rounded-full bg-slate-300" />

            <Text className="mb-1 text-[22px] font-extrabold text-slate-900">Register Member</Text>
            <Text className="mb-4 text-[14px] font-semibold text-slate-500">
              {registerTarget?.fullName?.trim() ||
                [registerTarget?.firstName, registerTarget?.lastName].filter(Boolean).join(" ").trim() ||
                registerTarget?.name ||
                "Selected member"}
            </Text>

            <View className="gap-2">
              <View className="flex-row items-end gap-2">
                <View className="flex-1 gap-2">
                  <Text className="text-xs font-bold uppercase text-slate-500">Select Ministry</Text>

                  <Pressable
                    onPress={() => setRegisterDropdownOpen((prev) => !prev)}
                    className="min-h-[48px] flex-row items-center justify-between rounded-[14px] border border-slate-200 bg-slate-50 px-4"
                    style={({ pressed }) =>
                      pressed ? { opacity: 0.88, transform: [{ scale: 0.98 }] } : undefined
                    }
                  >
                    <Text
                      className={`flex-1 text-[15px] font-bold ${
                        registerSelectedMinistries.length ? "text-slate-900" : "text-slate-400"
                      }`}
                    >
                      {registerSelectedMinistries.length
                        ? registerSelectedMinistries.join(", ")
                        : "Select Ministry"}
                    </Text>
                    <MaterialIcons
                      name={registerDropdownOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                      size={22}
                      color="#6B7280"
                    />
                  </Pressable>
                </View>

                <Pressable
                  onPress={saveCareGroupImmediately}
                  className="min-h-[48px] rounded-[14px] bg-slate-900 px-4"
                  style={({ pressed }) =>
                    pressed ? { opacity: 0.88, transform: [{ scale: 0.98 }] } : undefined
                  }
                  disabled={registerCareGroupSaving}
                >
                  <View className="flex-1 flex-row items-center justify-center gap-1">
                    <Text className="text-[13px] font-extrabold text-white">
                      {registerCareGroupSaving
                        ? "Saving..."
                        : registerCareGroupSaved
                          ? "CareGroup ✓"
                          : "CareGroup +"}
                    </Text>
                  </View>
                </Pressable>
              </View>

              {registerDropdownOpen ? (
                <View className="max-h-[260px] overflow-hidden rounded-[14px] border border-slate-200 bg-white">
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {ministryOptions.length ? (
                      ministryOptions.map((option) => {
                        const selected = registerSelectedMinistries.includes(option.name);
                        return (
                          <Pressable
                            key={option.id}
                            onPress={() => toggleRegisterMinistry(option.name)}
                            className={`min-h-[46px] flex-row items-center justify-between px-4 ${
                              selected ? "bg-blue-50" : "bg-white"
                            }`}
                            style={({ pressed }) =>
                              pressed ? { backgroundColor: "#F8FAFC" } : undefined
                            }
                          >
                            <View className="flex-row items-center gap-3">
                              <View className="h-[22px] w-[22px] items-center justify-center rounded-md border border-slate-400 bg-white">
                                {selected ? (
                                  <Text className="text-sm font-extrabold text-emerald-600">✓</Text>
                                ) : null}
                              </View>
                              <Text className="text-[15px] font-semibold text-slate-900">
                                {option.name}
                              </Text>
                            </View>

                            {selected ? <MaterialIcons name="check" size={18} color="#2563EB" /> : null}
                          </Pressable>
                        );
                      })
                    ) : (
                      <View className="px-4 py-3">
                        <Text className="text-[13px] text-slate-500">No ministries found</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            <View className="mt-4 flex-row justify-end gap-2">
              <Pressable
                onPress={closeRegisterModal}
                className="rounded-[14px] bg-slate-200 px-4 py-3"
                style={({ pressed }) =>
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                }
                disabled={registerSavingId === registerTarget?.id}
              >
                <Text className="font-extrabold text-slate-900">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={confirmRegister}
                className="rounded-[14px] bg-emerald-600 px-4 py-3"
                style={({ pressed }) =>
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                }
                disabled={registerSavingId === registerTarget?.id}
              >
                <Text className="font-extrabold text-white">
                  {registerSavingId === registerTarget?.id ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
      <View className="flex-row items-center gap-2 rounded-[12px] bg-slate-50 px-3 py-2">
        <MaterialIcons name="search" size={20} color="#6B7280" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Type to search members"
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