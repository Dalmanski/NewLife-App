import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  Image,
} from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";

export type Gender = "NA" | "male" | "female";
export type MemberStatus = "unregister" | "pending" | "register";
export type MemberRole = "member" | "admin";
export type SortField = "name" | "idx";
export type SortDirection = "asc" | "desc";
export type ActiveSelector =
  | "ministry"
  | "status"
  | "civilStatus"
  | "role"
  | "gender"
  | null;

export type OptionItem = {
  id: string;
  name: string;
  colorTag?: string;
};

export type TagItem = {
  name: string;
  color: string;
};

export type SocialLinkItem = {
  url: string;
  platform: string;
  host: string;
  color: string;
  icon: string;
};

export type MemberFormState = {
  name: string;
  firstName: string;
  lastName: string;
  password: string;
  contact: string;
  socialLinks: string[];
  profileImageUrl?: string;
};

export type MemberRecord = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  password?: string;
  contact?: string;
  civilStatus?: string;
  gender?: Gender;
  ministry: string[];
  status: MemberStatus;
  role?: MemberRole;
  idx?: number;
  startedAt?: number | null;
  statusChangedAt?: number | null;
  tags?: TagItem[];
  socialLinks?: SocialLinkItem[];
  profileImageUrl?: string;
};

export type ActionMenuState = {
  visible: boolean;
  item: MemberRecord | null;
  top: number;
  left: number;
};

export const TAG_COLOR_OPTIONS = [
  "#2563EB",
  "#7C3AED",
  "#DB2777",
  "#EA580C",
  "#16A34A",
  "#0F766E",
  "#4B5563",
  "#D97706",
];

export const emptyMemberForm: MemberFormState = {
  name: "",
  firstName: "",
  lastName: "",
  password: "",
  contact: "",
  socialLinks: [""],
  profileImageUrl: "",
};

export const MINISTRY_TAG_COLOR_MAP: Record<string, string> = {
  gray: "#6B7280",
  blue: "#2563EB",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  purple: "#8B5CF6",
  pink: "#EC4899",
  teal: "#14B8A6",
};

export const HEX_TO_KEY_MAP: Record<string, string> = {
  "#6B7280": "gray",
  "#2563EB": "blue",
  "#10B981": "green",
  "#F59E0B": "amber",
  "#EF4444": "red",
  "#8B5CF6": "purple",
  "#EC4899": "pink",
  "#14B8A6": "teal",
};

export const normalizeMinistryColorTag = (value: unknown) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized.match(/^#[0-9A-F]{6}$/)) {
    return normalized;
  }
  const lowerNorm = normalized.toLowerCase();
  if (MINISTRY_TAG_COLOR_MAP[lowerNorm]) {
    return MINISTRY_TAG_COLOR_MAP[lowerNorm];
  }
  return MINISTRY_TAG_COLOR_MAP.gray;
};

export const statusLabel: Record<MemberStatus, string> = {
  unregister: "Unregister",
  pending: "Pending",
  register: "Register",
};

export const statusColor: Record<MemberStatus, string> = {
  unregister: "#DC2626",
  pending: "#F59E0B",
  register: "#16A34A",
};

export const roleLabel: Record<MemberRole, string> = {
  member: "Member",
  admin: "Admin",
};

export const genderLabel: Record<Gender, string> = {
  NA: "NA",
  male: "Male",
  female: "Female",
};

export const roleOptions: OptionItem[] = [
  { id: "member", name: "Member" },
  { id: "admin", name: "Admin" },
];

export const genderOptions: OptionItem[] = [
  { id: "NA", name: "NA" },
  { id: "male", name: "Male" },
  { id: "female", name: "Female" },
];

export const statusOptions: { id: MemberStatus; name: string }[] = [
  { id: "unregister", name: "Unregister" },
  { id: "pending", name: "Pending" },
  { id: "register", name: "Register" },
];

export const civilStatusOptions: OptionItem[] = [
  { id: "Single", name: "Single" },
  { id: "Married", name: "Married" },
  { id: "Widowed", name: "Widowed" },
  { id: "Separated", name: "Separated" },
  { id: "Divorced", name: "Divorced" },
  { id: "NA", name: "NA" },
];

export const normalizeNA = (value: unknown) => {
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "na") return "NA";
  return text;
};

export const normalizeStatus = (value: unknown): MemberStatus => {
  const status = String(value ?? "").trim().toLowerCase();
  if (status === "unregister" || status === "pending" || status === "register") return status;
  return "unregister";
};

export const normalizeRole = (value: unknown): MemberRole => {
  const role = String(value ?? "").trim().toLowerCase();
  if (role === "admin") return "admin";
  return "member";
};

export const normalizeGender = (value: unknown): Gender => {
  const gender = String(value ?? "").trim().toLowerCase();
  if (gender === "male") return "male";
  if (gender === "female") return "female";
  return "NA";
};

export const normalizeTimestamp = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;

    const dateParsed = Date.parse(value);
    if (!Number.isNaN(dateParsed)) return dateParsed;
  }

  if (value && typeof value === "object") {
    const obj = value as {
      seconds?: number;
      nanoseconds?: number;
      toMillis?: () => number;
    };

    if (typeof obj.toMillis === "function") return obj.toMillis();
    if (typeof obj.seconds === "number") {
      return obj.seconds * 1000 + Math.floor((obj.nanoseconds ?? 0) / 1_000_000);
    }
  }

  return null;
};

export const splitFullName = (value: unknown) => {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return { firstName: "", lastName: "" };
  const parts = text.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

type SocialPlatformMeta = {
  platform: string;
  host: string;
  color: string;
  icon: string;
};

export const detectSocialPlatform = (value: string): SocialPlatformMeta => {
  const text = String(value ?? "").trim();
  if (!text) {
    return {
      platform: "Website",
      host: "",
      color: "#64748B",
      icon: "public",
    };
  }

  let candidate = text;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

    if (
      host.includes("facebook.com") ||
      host === "fb.com" ||
      host.endsWith(".fb.com") ||
      host.includes("fb.me")
    ) {
      return { platform: "Facebook", host, color: "#1877F2", icon: "language" };
    }

    if (host.includes("instagram.com")) {
      return { platform: "Instagram", host, color: "#E1306C", icon: "photo-camera" };
    }

    if (host.includes("tiktok.com")) {
      return { platform: "TikTok", host, color: "#111827", icon: "music-note" };
    }

    if (host === "x.com" || host.includes("twitter.com")) {
      return { platform: "X", host, color: "#111827", icon: "close" };
    }

    if (host.includes("youtube.com") || host === "youtu.be") {
      return { platform: "YouTube", host, color: "#FF0000", icon: "play-circle-outline" };
    }

    if (host.includes("linkedin.com")) {
      return { platform: "LinkedIn", host, color: "#0A66C2", icon: "work" };
    }

    if (host.includes("threads.net")) {
      return { platform: "Threads", host, color: "#111827", icon: "forum" };
    }

    if (host.includes("github.com")) {
      return { platform: "GitHub", host, color: "#111827", icon: "code" };
    }

    if (host.includes("reddit.com")) {
      return { platform: "Reddit", host, color: "#FF4500", icon: "groups" };
    }

    if (host.includes("t.me") || host.includes("telegram.me")) {
      return { platform: "Telegram", host, color: "#229ED9", icon: "send" };
    }

    if (host.includes("wa.me") || host.includes("whatsapp.com")) {
      return { platform: "WhatsApp", host, color: "#25D366", icon: "chat" };
    }

    if (host.includes("discord.com")) {
      return { platform: "Discord", host, color: "#5865F2", icon: "chat" };
    }

    return {
      platform: host ? "Website" : "Unknown",
      host,
      color: "#64748B",
      icon: "public",
    };
  } catch {
    return {
      platform: "Unknown",
      host: "",
      color: "#64748B",
      icon: "link",
    };
  }
};

export const normalizeSocialLinks = (value: unknown): SocialLinkItem[] => {
  if (!Array.isArray(value)) return [];

  const result: SocialLinkItem[] = [];
  const seen = new Set<string>();

  value.forEach((item) => {
    let url = "";

    if (typeof item === "string") {
      url = item.trim();
    } else if (item && typeof item === "object") {
      const raw = item as { url?: unknown; link?: unknown; value?: unknown };
      url = String(raw.url ?? raw.link ?? raw.value ?? "").trim();
    }

    if (!url) return;

    const key = url.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const meta = detectSocialPlatform(url);
    result.push({
      url,
      platform: meta.platform,
      host: meta.host,
      color: meta.color,
      icon: meta.icon,
    });
  });

  return result;
};

export const normalizeTags = (value: unknown): TagItem[] => {
  if (!Array.isArray(value)) return [];

  const result: TagItem[] = [];

  value.forEach((item) => {
    if (typeof item === "string") {
      const name = item.trim();
      if (name) result.push({ name, color: "#64748B" });
      return;
    }

    if (item && typeof item === "object") {
      const raw = item as { name?: unknown; color?: unknown };
      const name = String(raw.name ?? "").trim();
      if (!name) return;
      const color = String(raw.color ?? "#64748B").trim() || "#64748B";
      result.push({ name, color });
    }
  });

  const seen = new Set<string>();
  return result.filter((tag) => {
    const key = tag.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

type ManageMemberModalProps = {
  formOpen: boolean;
  setFormOpen: (value: boolean) => void;

  selectorOpen: boolean;
  setSelectorOpen: (value: boolean) => void;
  activeSelector: ActiveSelector;
  setActiveSelector: (value: ActiveSelector) => void;

  sortOpen: boolean;
  setSortOpen: (value: boolean) => void;

  actionMenu: ActionMenuState;
  onCloseActionMenu: () => void;
  onEditItem: (item: MemberRecord) => void;
  onTaskItem: (item: MemberRecord) => void;

  editingId: string | null;
  form: MemberFormState;
  setForm: React.Dispatch<React.SetStateAction<MemberFormState>>;

  selectedStatus: MemberStatus;
  setSelectedStatus: React.Dispatch<React.SetStateAction<MemberStatus>>;

  selectedCivilStatus: string;
  setSelectedCivilStatus: React.Dispatch<React.SetStateAction<string>>;

  selectedRole: MemberRole;
  setSelectedRole: React.Dispatch<React.SetStateAction<MemberRole>>;

  selectedGender: Gender;
  setSelectedGender: React.Dispatch<React.SetStateAction<Gender>>;

  selectedStartedAt: number;
  setSelectedStartedAt: React.Dispatch<React.SetStateAction<number>>;

  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;

  showStartedDatePicker: boolean;
  setShowStartedDatePicker: React.Dispatch<React.SetStateAction<boolean>>;

  selectedMinistries: string[];
  setSelectedMinistries: React.Dispatch<React.SetStateAction<string[]>>;

  ministryOptions: OptionItem[];
  loadingOptions: boolean;
  saving: boolean;
  onSave: () => void | Promise<void>;

  sortField: SortField;
  setSortField: React.Dispatch<React.SetStateAction<SortField>>;

  sortDirection: SortDirection;
  setSortDirection: React.Dispatch<React.SetStateAction<SortDirection>>;

  onOpenSelector: (kind: ActiveSelector) => Promise<void> | void;

  selectedTags: TagItem[];
  setSelectedTags: React.Dispatch<React.SetStateAction<TagItem[]>>;

  deleteConfirmOpen: boolean;
  setDeleteConfirmOpen: (value: boolean) => void;
  deleteTarget: MemberRecord | null;
  onConfirmDelete: () => void | Promise<void>;
  onRequestDelete: (item: MemberRecord) => void;

  statusChangeOpen: boolean;
  setStatusChangeOpen: (value: boolean) => void;
  statusChangeTarget: MemberRecord | null;
  onConfirmStatusChange: (status: MemberStatus) => void | Promise<void>;
};

export default function ManageMemberModal({
  formOpen,
  setFormOpen,
  selectorOpen,
  setSelectorOpen,
  activeSelector,
  setActiveSelector,
  sortOpen,
  setSortOpen,
  actionMenu,
  onCloseActionMenu,
  onEditItem,
  onTaskItem,
  editingId,
  form,
  setForm,
  selectedStatus,
  setSelectedStatus,
  selectedCivilStatus,
  setSelectedCivilStatus,
  selectedRole,
  setSelectedRole,
  selectedGender,
  setSelectedGender,
  selectedStartedAt,
  setSelectedStartedAt,
  showPassword,
  setShowPassword,
  showStartedDatePicker,
  setShowStartedDatePicker,
  selectedMinistries,
  setSelectedMinistries,
  ministryOptions,
  loadingOptions,
  saving,
  onSave,
  sortField,
  setSortField,
  sortDirection,
  setSortDirection,
  onOpenSelector,
  selectedTags,
  setSelectedTags,
  deleteConfirmOpen,
  setDeleteConfirmOpen,
  deleteTarget,
  onConfirmDelete,
  onRequestDelete,
  statusChangeOpen,
  setStatusChangeOpen,
  statusChangeTarget,
  onConfirmStatusChange,
}: ManageMemberModalProps) {
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagEditingIndex, setTagEditingIndex] = useState<number | null>(null);
  const [tagDraftName, setTagDraftName] = useState("");
  const [tagDraftColor, setTagDraftColor] = useState(TAG_COLOR_OPTIONS[0]);

  const activeOptions =
    activeSelector === "ministry"
      ? ministryOptions
      : activeSelector === "civilStatus"
        ? civilStatusOptions
        : activeSelector === "role"
          ? roleOptions
          : activeSelector === "gender"
            ? genderOptions
            : statusOptions;

  const activeTitle =
    activeSelector === "ministry"
      ? "Select Ministry"
      : activeSelector === "civilStatus"
        ? "Select Civil Status"
        : activeSelector === "role"
          ? "Select Role"
          : activeSelector === "gender"
            ? "Select Gender"
            : "Select Status";

  const activeSelected =
    activeSelector === "ministry"
      ? selectedMinistries
      : activeSelector === "civilStatus"
        ? [selectedCivilStatus]
        : activeSelector === "role"
          ? [selectedRole]
          : activeSelector === "gender"
            ? [selectedGender]
            : [selectedStatus];

  const toggleSelected = (value: string) => {
    if (activeSelector === "ministry") {
      setSelectedMinistries((prev) =>
        prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
      );
      return;
    }

    if (activeSelector === "status") {
      setSelectedStatus(value as MemberStatus);
      return;
    }

    if (activeSelector === "civilStatus") {
      setSelectedCivilStatus(value);
      return;
    }

    if (activeSelector === "role") {
      setSelectedRole(value as MemberRole);
      return;
    }

    if (activeSelector === "gender") {
      setSelectedGender(value as Gender);
    }
  };

  const closeSelector = () => {
    setActiveSelector(null);
    setSelectorOpen(false);
  };

  const openTagEditor = (index?: number) => {
    if (typeof index === "number") {
      const item = selectedTags[index];
      if (!item) return;
      setTagEditingIndex(index);
      setTagDraftName(item.name);
      setTagDraftColor(item.color || TAG_COLOR_OPTIONS[0]);
    } else {
      setTagEditingIndex(null);
      setTagDraftName("");
      setTagDraftColor(TAG_COLOR_OPTIONS[0]);
    }
    setTagModalOpen(true);
  };

  const saveTag = () => {
    const name = tagDraftName.trim();
    if (!name) {
      Alert.alert("Error", "Tag name is required");
      return;
    }

    const nextTag = {
      name,
      color: tagDraftColor,
    };

    setSelectedTags((prev) => {
      if (tagEditingIndex !== null) {
        const next = [...prev];
        next[tagEditingIndex] = nextTag;
        return next.filter((tag) => tag.name.trim());
      }
      return [...prev, nextTag].filter((tag) => tag.name.trim());
    });

    setTagModalOpen(false);
    setTagEditingIndex(null);
    setTagDraftName("");
    setTagDraftColor(TAG_COLOR_OPTIONS[0]);
  };

  const deleteTag = (index: number) => {
    setSelectedTags((prev) => prev.filter((_, i) => i !== index));
  };



  const closeTagModal = () => {
    setTagModalOpen(false);
    setTagEditingIndex(null);
    setTagDraftName("");
    setTagDraftColor(TAG_COLOR_OPTIONS[0]);
  };

  const addSocialLink = () => {
    setForm((prev) => ({
      ...prev,
      socialLinks: [...(prev.socialLinks?.length ? prev.socialLinks : [""]), ""],
    }));
  };

  const updateSocialLink = (index: number, value: string) => {
    setForm((prev) => {
      const next = [...(prev.socialLinks?.length ? prev.socialLinks : [""])];
      next[index] = value;
      return {
        ...prev,
        socialLinks: next,
      };
    });
  };

  const removeSocialLink = (index: number) => {
    setForm((prev) => {
      const next = [...(prev.socialLinks?.length ? prev.socialLinks : [""])];
      next.splice(index, 1);
      return {
        ...prev,
        socialLinks: next.length ? next : [""],
      };
    });
  };

  return (
    <>
      <Modal
        visible={formOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFormOpen(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-5 py-6"
          onPress={() => setFormOpen(false)}
        >
          <Pressable
            className="w-full max-w-[560px] rounded-[24px] bg-white px-[18px] pb-[18px] pt-2"
            onPress={() => {}}
          >
            <View className="mb-3 self-center h-[5px] w-[44px] rounded-full bg-slate-300" />
            <View className="mb-3 flex-row items-center justify-between gap-3">
              <Text className="flex-1 text-[22px] font-extrabold text-slate-900">
                {editingId ? "Edit Member" : "Add Member"}
              </Text>

              <Pressable
                onPress={() => onOpenSelector("role")}
                className="flex-row items-center gap-2 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2"
                style={({ pressed }) =>
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                }
              >
                <MaterialIcons name="admin-panel-settings" size={18} color="#6B7280" />
                <Text className="text-[12px] font-extrabold uppercase tracking-[0.6px] text-slate-500">
                  Role:
                </Text>
                <Text className="text-[15px] font-bold text-slate-900">
                  {roleLabel[selectedRole]}
                </Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator
              showsHorizontalScrollIndicator={false}
              persistentScrollbar
              nestedScrollEnabled
              style={{
                maxHeight: "78vh" as any,
                overflowY: "scroll" as any,
                overflowX: "hidden" as any,
              }}
              contentContainerStyle={{
                paddingBottom: 8,
              }}
            >
              <View style={{ minWidth: "100%" }}>
                <View className="gap-3">
                  <PaperField
                    label="Nickname"
                    value={form.name}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
                    icon="account"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <PaperField
                        label="First Name"
                        value={form.firstName}
                        onChangeText={(value) => setForm((prev) => ({ ...prev, firstName: value }))}
                        icon="account-outline"
                        autoCapitalize="words"
                        autoCorrect={false}
                      />
                    </View>

                    <View className="flex-1">
                      <PaperField
                        label="Last Name"
                        value={form.lastName}
                        onChangeText={(value) => setForm((prev) => ({ ...prev, lastName: value }))}
                        icon="account-outline"
                        autoCapitalize="words"
                        autoCorrect={false}
                      />
                    </View>
                  </View>

                  <View className="relative">
                    <PaperTextInput
                      mode="outlined"
                      label="Password"
                      value={form.password}
                      onChangeText={(value) => setForm((prev) => ({ ...prev, password: value }))}
                      left={<PaperTextInput.Icon icon="lock" />}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      dense
                      style={{
                        backgroundColor: "#FFFFFF",
                        paddingRight: 44,
                      }}
                      outlineStyle={{
                        borderRadius: 14,
                        borderColor: "#E2E8F0",
                      }}
                      contentStyle={{
                        paddingVertical: 6,
                      }}
                      theme={{
                        roundness: 14,
                        colors: {
                          primary: "#2563EB",
                        },
                      }}
                    />

                    <Pressable
                      onPress={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-[15px] h-7 w-7 items-center justify-center"
                      hitSlop={10}
                    >
                      <MaterialIcons
                        name={showPassword ? "visibility-off" : "visibility"}
                        size={22}
                        color="#6B7280"
                      />
                    </Pressable>
                  </View>

                  <PaperField
                    label="Contact"
                    value={form.contact}
                    onChangeText={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        contact: value.replace(/[^0-9]/g, ""),
                      }))
                    }
                    icon="phone"
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <SelectField
                        label="Civil Status"
                        value={selectedCivilStatus}
                        icon="favorite"
                        onPress={() => onOpenSelector("civilStatus")}
                      />
                    </View>

                    <View className="flex-1">
                      <SelectField
                        label="Gender"
                        value={genderLabel[selectedGender]}
                        icon="person"
                        onPress={() => onOpenSelector("gender")}
                      />
                    </View>
                  </View>

                  {editingId && (
                    <>
                      <SelectField
                        label="Ministry"
                        value={selectedMinistries.length ? selectedMinistries.join(", ") : "NA"}
                        icon="groups"
                        onPress={() => onOpenSelector("ministry")}
                      />

                      <View className="rounded-[14px] border border-slate-200 bg-white px-4 py-3">
                        <View className="mb-2 flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2">
                            <MaterialIcons name="link" size={18} color="#6B7280" />
                            <Text className="text-xs font-bold uppercase text-slate-500">
                              Social Links
                            </Text>
                          </View>
                          <Pressable
                            onPress={addSocialLink}
                            className="rounded-full bg-slate-900 px-3 py-1.5"
                            style={({ pressed }) =>
                              pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                            }
                          >
                            <Text className="text-xs font-extrabold text-white">+</Text>
                          </Pressable>
                        </View>

                        <View className="gap-3">
                          {(form.socialLinks?.length ? form.socialLinks : [""]).map((link, index) => {
                            const meta = detectSocialPlatform(link);
                            const hasValue = link.trim().length > 0;

                            return (
                              <View key={`social-link-${index}`} className="gap-2">
                                <PaperField
                                  label={`Link ${index + 1}`}
                                  value={link}
                                  onChangeText={(value) => updateSocialLink(index, value)}
                                  icon="link"
                                  rightIcon="close"
                                  onRightPress={() => removeSocialLink(index)}
                                  autoCapitalize="none"
                                  autoCorrect={false}
                                />

                                <View className="flex-row items-center justify-between gap-2">
                                  <View className="flex-row items-center gap-2">
                                    <View
                                      className="h-2.5 w-2.5 rounded-full"
                                      style={{ backgroundColor: hasValue ? meta.color : "#94A3B8" }}
                                    />
                                    <Text className="text-[12px] font-bold uppercase text-slate-500">
                                      {hasValue ? `Detected: ${meta.platform}` : "Enter a link"}
                                    </Text>
                                  </View>
                                  <Text className="flex-1 text-right text-[12px] text-slate-400">
                                    {hasValue ? meta.host : " "}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>

                      <View className="rounded-[14px] border border-slate-200 bg-white px-4 py-3">
                        <View className="mb-2 flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2">
                            <MaterialIcons name="label" size={18} color="#6B7280" />
                            <Text className="text-xs font-bold uppercase text-slate-500">Tags</Text>
                          </View>
                          <Pressable
                            onPress={() => openTagEditor()}
                            className="rounded-full bg-slate-900 px-3 py-1.5"
                            style={({ pressed }) =>
                              pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                            }
                          >
                            <Text className="text-xs font-extrabold text-white">Add Tag</Text>
                          </Pressable>
                        </View>

                        {selectedTags.length ? (
                          <View className="flex-row flex-wrap gap-2">
                            {selectedTags.map((tag, index) => (
                              <Pressable
                                key={`${tag.name}-${index}`}
                                onPress={() => openTagEditor(index)}
                                className="flex-row items-center gap-2 rounded-full px-3 py-2"
                                style={{
                                  backgroundColor: `${tag.color || "#64748B"}20`,
                                  borderWidth: 1,
                                  borderColor: tag.color || "#64748B",
                                }}
                              >
                                <View
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: tag.color || "#64748B" }}
                                />
                                <Text
                                  className="text-[12px] font-bold"
                                  style={{ color: tag.color || "#64748B" }}
                                >
                                  {tag.name}
                                </Text>
                                <Pressable
                                  onPress={() => deleteTag(index)}
                                  hitSlop={8}
                                  style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
                                >
                                  <MaterialIcons
                                    name="close"
                                    size={16}
                                    color={tag.color || "#64748B"}
                                  />
                                </Pressable>
                              </Pressable>
                            ))}
                          </View>
                        ) : (
                          <Text className="text-[14px] font-semibold text-slate-400">No tags added</Text>
                        )}
                      </View>
                    </>
                  )}

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
                      onPress={onSave}
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
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={selectorOpen}
        transparent
        animationType="fade"
        onRequestClose={closeSelector}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-5 py-6"
          onPress={closeSelector}
        >
          <Pressable
            className="w-full max-w-[520px] max-h-[90%] rounded-[24px] bg-white px-[18px] pb-[18px] pt-2"
            onPress={() => {}}
          >
            <View className="mb-3 self-center h-[5px] w-[44px] rounded-full bg-slate-300" />
            <Text className="mb-3 text-[22px] font-extrabold text-slate-900">{activeTitle}</Text>

            <ScrollView
              className="max-h-[430px]"
              contentContainerClassName="gap-2.5 pb-3"
              showsVerticalScrollIndicator
              showsHorizontalScrollIndicator={false}
              persistentScrollbar
              style={{
                overflowY: "scroll" as any,
                overflowX: "hidden" as any,
              }}
            >
              {loadingOptions && activeSelector === "ministry" ? (
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
                  const isGender = activeSelector === "gender";
                  const selected = isStatus
                    ? selectedStatus === item.id
                    : isCivilStatus
                      ? selectedCivilStatus === item.name
                      : isRole
                        ? selectedRole === item.id
                        : isGender
                          ? selectedGender === item.id
                          : activeSelected.includes(item.name);

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        toggleSelected(isStatus || isCivilStatus || isRole || isGender ? item.id : item.name)
                      }
                      className={`min-h-[48px] flex-row items-center gap-3 rounded-[14px] px-4 ${
                        selected ? "bg-blue-50" : "bg-slate-50"
                      }`}
                      style={({ pressed }) =>
                        pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                      }
                    >
                      <View className="h-[22px] w-[22px] items-center justify-center rounded-md border border-slate-400 bg-white">
                        {selected ? <Text className="text-sm font-extrabold text-emerald-600">✓</Text> : null}
                      </View>

                      {activeSelector === "ministry" ? (
                        <View
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              MINISTRY_TAG_COLOR_MAP[normalizeMinistryColorTag(item.colorTag ?? "gray")] ??
                              "#64748B",
                          }}
                        />
                      ) : null}

                      <Text className="flex-1 text-[15px] font-bold text-slate-900">{item.name}</Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <Pressable
              onPress={closeSelector}
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

      <Modal visible={tagModalOpen} transparent animationType="fade" onRequestClose={closeTagModal}>
        <Pressable className="flex-1 items-center justify-center bg-black/40 px-5 py-6" onPress={closeTagModal}>
          <Pressable
            className="w-full max-w-[460px] rounded-[24px] bg-white p-4"
            onPress={() => {}}
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
            }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[20px] font-extrabold text-slate-900">
                {tagEditingIndex !== null ? "Edit Tag" : "Add Tag"}
              </Text>
              <Pressable onPress={closeTagModal} hitSlop={10}>
                <MaterialIcons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            <View className="gap-3">
              <PaperTextInput
                mode="outlined"
                label="Tag Name"
                value={tagDraftName}
                onChangeText={setTagDraftName}
                left={<PaperTextInput.Icon icon="label" />}
                autoCapitalize="words"
                autoCorrect={false}
                dense
                style={{
                  backgroundColor: "#FFFFFF",
                }}
                outlineStyle={{
                  borderRadius: 14,
                  borderColor: "#E2E8F0",
                }}
                contentStyle={{
                  paddingVertical: 6,
                }}
                theme={{
                  roundness: 14,
                  colors: {
                    primary: "#2563EB",
                  },
                }}
              />

              <View className="gap-2">
                <Text className="text-xs font-bold uppercase text-slate-500">Color</Text>
                <View className="flex-row flex-wrap gap-2">
                  {TAG_COLOR_OPTIONS.map((color) => {
                    const selected = color === tagDraftColor;
                    return (
                      <Pressable
                        key={color}
                        onPress={() => setTagDraftColor(color)}
                        className="h-10 w-10 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: `${color}25`,
                          borderWidth: 2,
                          borderColor: selected ? color : "transparent",
                        }}
                      >
                        <View className="h-5 w-5 rounded-full" style={{ backgroundColor: color }} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="flex-row justify-end gap-2">
                <Pressable
                  onPress={closeTagModal}
                  className="rounded-[14px] bg-slate-200 px-4 py-3"
                  style={({ pressed }) =>
                    pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                  }
                >
                  <Text className="font-extrabold text-slate-900">Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={saveTag}
                  className="rounded-[14px] bg-slate-900 px-4 py-3"
                  style={({ pressed }) =>
                    pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                  }
                >
                  <Text className="font-extrabold text-white">
                    {tagEditingIndex !== null ? "Update" : "Save"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={sortOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortOpen(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/20 px-5 py-6"
          onPress={() => setSortOpen(false)}
        >
          <Pressable
            className="w-full max-w-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-white"
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

      <Modal
        visible={deleteConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmOpen(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-5 py-6"
          onPress={() => setDeleteConfirmOpen(false)}
        >
          <Pressable
            className="w-full max-w-[420px] rounded-[24px] bg-white p-5"
            onPress={() => {}}
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
            }}
          >
            <Text className="text-[20px] font-extrabold text-slate-900">Delete member?</Text>
            <Text className="mt-2 text-[15px] text-slate-600">
              Are you sure you want to delete{" "}
              <Text className="font-bold text-slate-900">
                {deleteTarget?.fullName?.trim() ||
                  [deleteTarget?.firstName, deleteTarget?.lastName].filter(Boolean).join(" ").trim() ||
                  deleteTarget?.name ||
                  "this member"}
              </Text>
              ?
            </Text>

            <View className="mt-5 flex-row justify-end gap-2">
              <Pressable
                onPress={() => setDeleteConfirmOpen(false)}
                className="rounded-[14px] bg-slate-200 px-4 py-3"
                style={({ pressed }) =>
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                }
              >
                <Text className="font-extrabold text-slate-900">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={onConfirmDelete}
                className="rounded-[14px] bg-red-600 px-4 py-3"
                style={({ pressed }) =>
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                }
              >
                <Text className="font-extrabold text-white">Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={statusChangeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusChangeOpen(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-5 py-6"
          onPress={() => setStatusChangeOpen(false)}
        >
          <Pressable
            className="w-full max-w-[420px] rounded-[24px] bg-white p-5"
            onPress={() => {}}
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
            }}
          >
            <Text className="text-[20px] font-extrabold text-slate-900">Change status</Text>
            <Text className="mt-2 text-[15px] text-slate-600">
              {statusChangeTarget?.fullName?.trim() ||
                [statusChangeTarget?.firstName, statusChangeTarget?.lastName].filter(Boolean).join(" ").trim() ||
                statusChangeTarget?.name ||
                "This member"}
            </Text>

            <View className="mt-4 gap-2">
              {(["unregister", "pending", "register"] as MemberStatus[]).map((status) => {
                const isActive = statusChangeTarget?.status === status;
                return (
                  <Pressable
                    key={status}
                    onPress={() => onConfirmStatusChange(status)}
                    className={`min-h-[48px] flex-row items-center justify-between rounded-[14px] px-4 ${
                      isActive ? "bg-blue-50" : "bg-slate-50"
                    }`}
                    style={({ pressed }) =>
                      pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                    }
                  >
                    <Text className="text-[15px] font-bold text-slate-900">
                      {statusLabel[status]}
                    </Text>
                    <View
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: statusColor[status] }}
                    />
                  </Pressable>
                );
              })}
            </View>

            <View className="mt-5 flex-row justify-end">
              <Pressable
                onPress={() => setStatusChangeOpen(false)}
                className="rounded-[14px] bg-slate-200 px-4 py-3"
                style={({ pressed }) =>
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                }
              >
                <Text className="font-extrabold text-slate-900">Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={actionMenu.visible && !!actionMenu.item} transparent animationType="none">
        <Pressable className="flex-1 bg-transparent" onPress={onCloseActionMenu}>
          <View
            className="absolute w-[176px] overflow-hidden rounded-[18px] bg-white"
            style={{
              top: actionMenu.top,
              left: actionMenu.left,
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 10,
            }}
          >
            <View className="border-b border-slate-100 px-4 py-3">
              <Text className="text-[16px] font-extrabold text-slate-900">Actions</Text>
              <Text className="mt-0.5 text-[13px] text-slate-500">
                {actionMenu.item?.fullName?.trim() ||
                  [actionMenu.item?.firstName, actionMenu.item?.lastName].filter(Boolean).join(" ").trim() ||
                  actionMenu.item?.name}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                const current = actionMenu.item;
                onCloseActionMenu();
                if (current) onEditItem(current);
              }}
              className="min-h-[52px] flex-row items-center gap-3 px-4"
              style={({ pressed }) => (pressed ? { backgroundColor: "#F8FAFC" } : undefined)}
            >
              <MaterialIcons name="edit" size={20} color="#2563EB" />
              <Text className="text-[15px] font-bold text-slate-900">Edit</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                const current = actionMenu.item;
                onCloseActionMenu();
                if (current) onTaskItem(current);
              }}
              className="min-h-[52px] flex-row items-center gap-3 px-4"
              style={({ pressed }) => (pressed ? { backgroundColor: "#F8FAFC" } : undefined)}
            >
              <MaterialIcons name="assignment" size={20} color="#7C3AED" />
              <Text className="text-[15px] font-bold text-slate-900">Task</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                const current = actionMenu.item;
                onCloseActionMenu();
                if (current) onRequestDelete(current);
              }}
              className="min-h-[52px] flex-row items-center gap-3 px-4"
              style={({ pressed }) => (pressed ? { backgroundColor: "#FEF2F2" } : undefined)}
            >
              <MaterialIcons name="delete" size={20} color="#DC2626" />
              <Text className="text-[15px] font-bold text-red-600">Delete</Text>
            </Pressable>

            <Pressable
              onPress={onCloseActionMenu}
              className="border-t border-slate-100 min-h-[52px] items-center justify-center"
              style={({ pressed }) => (pressed ? { backgroundColor: "#F8FAFC" } : undefined)}
            >
              <Text className="text-[15px] font-extrabold text-slate-700">Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function PaperField({
  label,
  value,
  onChangeText,
  icon,
  rightIcon,
  onRightPress,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoCorrect,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  icon: string;
  rightIcon?: string;
  onRightPress?: () => void;
  secureTextEntry?: boolean;
  keyboardType?: React.ComponentProps<typeof PaperTextInput>["keyboardType"];
  autoCapitalize?: React.ComponentProps<typeof PaperTextInput>["autoCapitalize"];
  autoCorrect?: boolean;
}) {
  return (
    <PaperTextInput
      mode="outlined"
      label={label}
      value={value}
      onChangeText={onChangeText}
      left={<PaperTextInput.Icon icon={icon} />}
      right={
        rightIcon
          ? (props) => (
              <PaperTextInput.Icon
                {...props}
                icon={rightIcon}
                onPress={onRightPress}
                forceTextInputFocus={false}
              />
            )
          : undefined
      }
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      dense
      style={{
        backgroundColor: "#FFFFFF",
      }}
      outlineStyle={{
        borderRadius: 14,
        borderColor: "#E2E8F0",
      }}
      contentStyle={{
        paddingVertical: 6,
      }}
      theme={{
        roundness: 14,
        colors: {
          primary: "#2563EB",
        },
      }}
    />
  );
}

function SelectField({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 gap-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3"
      style={({ pressed }) =>
        pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
      }
    >
      <View className="mb-1 flex-row items-center gap-2">
        <MaterialIcons name={icon as any} size={18} color="#6B7280" />
        <Text className="text-xs font-bold uppercase text-slate-500">{label}</Text>
      </View>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-[15px] font-bold text-slate-900">{value}</Text>
        <MaterialIcons name="keyboard-arrow-down" size={20} color="#6B7280" />
      </View>
    </Pressable>
  );
}

function formatInputDate(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return "Select date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateInputValue(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return "";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseWebDateValue(value: string) {
  const text = value.trim();
  if (!text) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date.getTime();
}