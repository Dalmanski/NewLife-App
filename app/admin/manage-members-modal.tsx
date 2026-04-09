// manage-member-modal.tsx
import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";

export type MemberStatus = "unregister" | "pending" | "register";
export type MemberRole = "member" | "admin";
export type SortField = "name" | "idx";
export type SortDirection = "asc" | "desc";
export type ActiveSelector =
  | "ministry"
  | "coreGroup"
  | "status"
  | "civilStatus"
  | "role"
  | null;

export type OptionItem = {
  id: string;
  name: string;
};

export type MemberFormState = {
  name: string;
  firstName: string;
  lastName: string;
  password: string;
  contact: string;
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
  ministry: string[];
  coreGroup: string[];
  status: MemberStatus;
  role?: MemberRole;
  idx?: number;
  startedAt?: number | null;
  statusChangedAt?: number | null;
};

export type ActionMenuState = {
  visible: boolean;
  item: MemberRecord | null;
  top: number;
  left: number;
};

export const emptyMemberForm: MemberFormState = {
  name: "",
  firstName: "",
  lastName: "",
  password: "",
  contact: "",
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

export const roleOptions: OptionItem[] = [
  { id: "member", name: "Member" },
  { id: "admin", name: "Admin" },
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

  selectedStartedAt: number;
  setSelectedStartedAt: React.Dispatch<React.SetStateAction<number>>;

  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;

  showStartedDatePicker: boolean;
  setShowStartedDatePicker: React.Dispatch<React.SetStateAction<boolean>>;

  selectedMinistries: string[];
  setSelectedMinistries: React.Dispatch<React.SetStateAction<string[]>>;

  selectedCoreGroups: string[];
  setSelectedCoreGroups: React.Dispatch<React.SetStateAction<string[]>>;

  ministryOptions: OptionItem[];
  coreGroupOptions: OptionItem[];
  loadingOptions: boolean;
  saving: boolean;
  onSave: () => void | Promise<void>;

  sortField: SortField;
  setSortField: React.Dispatch<React.SetStateAction<SortField>>;

  sortDirection: SortDirection;
  setSortDirection: React.Dispatch<React.SetStateAction<SortDirection>>;

  onOpenSelector: (kind: ActiveSelector) => Promise<void> | void;
  openAddMember: () => void;
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
  selectedStartedAt,
  setSelectedStartedAt,
  showPassword,
  setShowPassword,
  showStartedDatePicker,
  setShowStartedDatePicker,
  selectedMinistries,
  setSelectedMinistries,
  selectedCoreGroups,
  setSelectedCoreGroups,
  ministryOptions,
  coreGroupOptions,
  loadingOptions,
  saving,
  onSave,
  sortField,
  setSortField,
  sortDirection,
  setSortDirection,
  onOpenSelector,
  openAddMember,
}: ManageMemberModalProps) {
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

  const toggleSelected = (value: string) => {
    if (activeSelector === "ministry") {
      setSelectedMinistries((prev) =>
        prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
      );
      return;
    }

    if (activeSelector === "coreGroup") {
      setSelectedCoreGroups((prev) =>
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
    }
  };

  const closeSelector = () => {
    setActiveSelector(null);
    setSelectorOpen(false);
  };

  return (
    <>
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
                <Text className="text-[15px] font-bold text-slate-900">{roleLabel[selectedRole]}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-3 pb-2">
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

              <Pressable
                onPress={() => setShowStartedDatePicker((prev) => !prev)}
                className="gap-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3"
                style={({ pressed }) =>
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                }
              >
                <View className="mb-1 flex-row items-center gap-2">
                  <MaterialIcons name="event" size={18} color="#6B7280" />
                  <Text className="text-xs font-bold uppercase text-slate-500">Member Started</Text>
                </View>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-[15px] font-bold text-slate-900">
                    {formatInputDate(selectedStartedAt)}
                  </Text>
                  <MaterialIcons
                    name={showStartedDatePicker ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                    size={20}
                    color="#6B7280"
                  />
                </View>
              </Pressable>

              {showStartedDatePicker ? (
                <View className="overflow-hidden rounded-[16px] border border-slate-200 bg-slate-50 p-3">
                  <DateTimePicker
                    value={new Date(selectedStartedAt || Date.now())}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(_event, date) => {
                      if (date) {
                        setSelectedStartedAt(date.getTime());
                      }

                      if (Platform.OS === "android") {
                        setShowStartedDatePicker(false);
                      }
                    }}
                  />

                  {Platform.OS === "ios" ? (
                    <View className="mt-3 flex-row justify-end">
                      <Pressable
                        onPress={() => setShowStartedDatePicker(false)}
                        className="rounded-[14px] bg-slate-900 px-4 py-3"
                      >
                        <Text className="font-extrabold text-white">Done</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View className="flex-row gap-3">
                <SelectField
                  label="Civil Status"
                  value={selectedCivilStatus}
                  icon="favorite"
                  onPress={() => onOpenSelector("civilStatus")}
                />

                <SelectField
                  label="Status"
                  value={statusLabel[selectedStatus]}
                  icon="badge"
                  onPress={() => onOpenSelector("status")}
                />
              </View>

              <SelectField
                label="Ministry"
                value={selectedMinistries.length ? selectedMinistries.join(", ") : "NA"}
                icon="groups"
                onPress={() => onOpenSelector("ministry")}
              />

              <SelectField
                label="Core Group"
                value={selectedCoreGroups.length ? selectedCoreGroups.join(", ") : "NA"}
                icon="group-work"
                onPress={() => onOpenSelector("coreGroup")}
              />

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
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={selectorOpen}
        transparent
        animationType="slide"
        onRequestClose={closeSelector}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={closeSelector}>
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
                        toggleSelected(isStatus || isCivilStatus || isRole ? item.id : item.name)
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
            <Text className="px-4 pb-2 pt-4 text-[13px] font-extrabold text-slate-900">Sort by</Text>

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

      {actionMenu.visible && actionMenu.item ? (
        <Pressable className="absolute inset-0 z-50 bg-transparent" onPress={onCloseActionMenu}>
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
                {actionMenu.item.fullName?.trim() ||
                  [actionMenu.item.firstName, actionMenu.item.lastName].filter(Boolean).join(" ").trim() ||
                  actionMenu.item.name}
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
              onPress={onCloseActionMenu}
              className="border-t border-slate-100 min-h-[52px] items-center justify-center"
              style={({ pressed }) => (pressed ? { backgroundColor: "#F8FAFC" } : undefined)}
            >
              <Text className="text-[15px] font-extrabold text-slate-700">Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      ) : null}
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

function formatList(items?: string[]) {
  if (!items || items.length === 0) return "NA";
  if (items.length <= 2) return items.join(", ");
  return `${items.slice(0, 2).join(", ")} +${items.length - 2}`;
}

function formatTimestamp(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "NA";
  return new Date(value).toLocaleString();
}

function formatInputDate(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Select date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}