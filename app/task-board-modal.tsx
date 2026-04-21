import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";

type ChecklistItem = {
  text: string;
  done: boolean;
};

type BoardColumn = {
  id: string;
  label: string;
};

type TaskModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  editingTaskId: string | null;
  taskTitle: string;
  onTaskTitleChange: (text: string) => void;
  taskDescription: string;
  onTaskDescriptionChange: (text: string) => void;
  deadline: Date;
  onDeadlineChange: (date: Date) => void;
  showDatePicker: boolean;
  onShowDatePickerChange: (show: boolean) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  columns: BoardColumn[];
  showChecklist: boolean;
  onChecklistToggle?: (show: boolean) => void;
  taskChecklist: ChecklistItem[];
  onChecklistItemChange: (index: number, text: string) => void;
  onChecklistItemRemove: (index: number) => void;
  onChecklistItemAdd: () => void;
  selectedMemberNames: string[];
  showMemberDropdown: boolean;
  onMemberDropdownChange: (show: boolean) => void;
  eligibleUsers: Array<{
    id: string;
    name: string;
    role: string;
    ministry: string[];
    coreGroup: string[];
  }>;
  selectedMemberIds: string[];
  onMemberToggle: (memberId: string) => void;
  hasGroupContext: boolean;
  hasMemberContext: boolean;
  greetingName: string;
  saving: boolean;
  formatDateDisplay: (date: Date) => string;
};

type ListModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  editingColumnId: string | null;
  listName: string;
  onListNameChange: (text: string) => void;
  columns: BoardColumn[];
  onMoveColumn: (index: number, direction: -1 | 1) => Promise<void>;
  onDeleteList: () => void;
};

type TaskActionMenuModalProps = {
  visible: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

type DeleteConfirmModalProps = {
  visible: boolean;
  taskTitle: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function TaskModal({
  visible,
  onClose,
  onSave,
  editingTaskId,
  taskTitle,
  onTaskTitleChange,
  taskDescription,
  onTaskDescriptionChange,
  deadline,
  onDeadlineChange,
  showDatePicker,
  onShowDatePickerChange,
  selectedStatus,
  onStatusChange,
  columns,
  showChecklist,
  onChecklistToggle,
  taskChecklist,
  onChecklistItemChange,
  onChecklistItemRemove,
  onChecklistItemAdd,
  selectedMemberNames,
  showMemberDropdown,
  onMemberDropdownChange,
  eligibleUsers,
  selectedMemberIds,
  onMemberToggle,
  hasGroupContext,
  hasMemberContext,
  greetingName,
  saving,
  formatDateDisplay,
}: TaskModalProps) {
  const [memberSearch, setMemberSearch] = useState("");
  const [webDateValue, setWebDateValue] = useState(formatDateInput(deadline));

  useEffect(() => {
    if (!showMemberDropdown) {
      setMemberSearch("");
    }
  }, [showMemberDropdown]);

  useEffect(() => {
    if (showDatePicker) {
      setWebDateValue(formatDateInput(deadline));
    }
  }, [showDatePicker, deadline]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return eligibleUsers;
    return eligibleUsers.filter((member) =>
      member.name.toLowerCase().includes(query)
    );
  }, [eligibleUsers, memberSearch]);

  const handleChecklistToggle = () => {
    if (typeof onChecklistToggle === "function") {
      onChecklistToggle(!showChecklist);
    }
  };

  const handleNativeDateChange = (_event: any, selected?: Date) => {
    if (Platform.OS !== "ios") {
      onShowDatePickerChange(false);
    }
    if (selected) {
      onDeadlineChange(selected);
    }
  };

  const handleWebDateDone = () => {
    const parsed = parseDateInput(webDateValue);
    if (parsed) {
      onDeadlineChange(parsed);
    }
    onShowDatePickerChange(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center px-4">
        <Pressable
          className="absolute inset-0 bg-black/45"
          onPress={onClose}
          style={{ zIndex: 0 }}
        />
        <View
          className="w-full rounded-[28px] bg-white px-[18px] pb-[18px] pt-3"
          style={{
            maxHeight: "90%",
            zIndex: 10,
            position: "relative",
            elevation: 10,
          }}
        >
          <Text className="mb-3 text-center text-[22px] font-black text-slate-900">
            {editingTaskId ? "Edit Task" : "New Task"}
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          >
            <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 10 }}>
              <PaperTextInput
                mode="outlined"
                label="Task title"
                value={taskTitle}
                onChangeText={onTaskTitleChange}
                placeholder=""
                outlineColor="#dbe4ee"
                activeOutlineColor="#94a3b8"
                textColor="#0f172a"
                theme={{ roundness: 8 }}
                contentStyle={{ backgroundColor: "#fff" }}
                style={{ backgroundColor: "#fff", borderRadius: 8 }}
              />
            </View>

            <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 10 }}>
              <PaperTextInput
                mode="outlined"
                label="Description"
                value={taskDescription}
                onChangeText={onTaskDescriptionChange}
                placeholder=""
                outlineColor="#dbe4ee"
                activeOutlineColor="#94a3b8"
                textColor="#0f172a"
                theme={{ roundness: 8 }}
                multiline
                numberOfLines={4}
                contentStyle={{ backgroundColor: "#fff" }}
                style={{ backgroundColor: "#fff", borderRadius: 8 }}
              />
            </View>

            <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 8 }}>
              <Text className="text-[13px] font-extrabold text-slate-900">
                Deadline
              </Text>
              <Pressable
                onPress={() => onShowDatePickerChange(true)}
                className="flex-row items-center rounded-[16px] border border-slate-200 bg-white px-4 py-3"
                style={({ pressed }) =>
                  pressed
                    ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                    : undefined
                }
              >
                <Ionicons name="calendar-outline" size={18} color="#111827" />
                <Text className="ml-2 text-[15px] font-bold text-slate-900">
                  {formatDateDisplay(deadline)}
                </Text>
              </Pressable>
            </View>

            <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 8 }}>
              <Pressable
                onPress={handleChecklistToggle}
                className="flex-row items-center justify-between rounded-[16px] bg-white px-4 py-3"
                style={({ pressed }) =>
                  pressed
                    ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                    : undefined
                }
              >
                <View>
                  <Text className="text-[13px] font-extrabold text-slate-900">
                    Checklist
                  </Text>
                  <Text className="mt-0.5 text-xs font-medium text-slate-500">
                    {showChecklist ? "Shown" : "Hidden"}
                  </Text>
                </View>

                <View
                  className={`h-7 w-14 rounded-full p-1 ${
                    showChecklist ? "bg-slate-900" : "bg-slate-300"
                  }`}
                >
                  <View
                    className={`h-5 w-5 rounded-full bg-white ${
                      showChecklist ? "ml-6" : "ml-0"
                    }`}
                  />
                </View>
              </Pressable>

              {showChecklist ? (
                <View style={{ gap: 10 }}>
                  {taskChecklist.length === 0 ? (
                    <View className="rounded-[16px] border border-dashed border-slate-300 bg-white px-4 py-4">
                      <Text className="text-sm font-semibold text-slate-500">
                        No checklist items yet
                      </Text>
                    </View>
                  ) : null}

                  {taskChecklist.map((item, index) => (
                    <View
                      key={index}
                      className="flex-row items-center"
                      style={{ gap: 10 }}
                    >
                      <PaperTextInput
                        mode="outlined"
                        label={`Checklist ${index + 1}`}
                        value={item.text}
                        onChangeText={(text) =>
                          onChecklistItemChange(index, text)
                        }
                        placeholder=""
                        outlineColor="#dbe4ee"
                        activeOutlineColor="#94a3b8"
                        textColor="#0f172a"
                        theme={{ roundness: 8 }}
                        contentStyle={{ backgroundColor: "#fff" }}
                        style={{
                          flex: 1,
                          backgroundColor: "#fff",
                          borderRadius: 8,
                        }}
                      />
                      <Pressable
                        onPress={() => onChecklistItemRemove(index)}
                        className="h-10 w-10 items-center justify-center rounded-[14px] bg-red-500"
                        style={({ pressed }) =>
                          pressed
                            ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                            : undefined
                        }
                      >
                        <Ionicons name="close" size={18} color="#fff" />
                      </Pressable>
                    </View>
                  ))}

                  <Pressable
                    onPress={onChecklistItemAdd}
                    className="self-start flex-row items-center rounded-full bg-slate-900 px-4 py-2.5"
                    style={({ pressed }) =>
                      pressed
                        ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                        : undefined
                    }
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text className="ml-2 font-bold text-white">
                      Add checklist item
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 8 }}>
              <Text className="text-[13px] font-extrabold text-slate-900">
                Assign Members
              </Text>

              <Pressable
                onPress={() => onMemberDropdownChange(true)}
                className="flex-row items-center justify-between rounded-[16px] border border-slate-200 bg-white px-4 py-3"
                style={({ pressed }) =>
                  pressed
                    ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                    : undefined
                }
              >
                <Text className="text-[15px] font-bold text-slate-900">
                  {selectedMemberNames.length > 0
                    ? `Selected Members (${selectedMemberNames.length})`
                    : "Select Members"}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#111827" />
              </Pressable>

              {selectedMemberNames.length > 0 ? (
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {selectedMemberNames.map((name, index) => (
                    <View
                      key={`${name}-${index}`}
                      className="flex-row items-center rounded-full bg-slate-200 px-3 py-1.5"
                      style={{ gap: 6 }}
                    >
                      <View className="h-4 w-4 items-center justify-center rounded-full bg-white">
                        <Ionicons name="person" size={11} color="#64748b" />
                      </View>
                      <Text className="text-xs font-bold text-slate-900">
                        {name}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {hasMemberContext ? (
                <View className="rounded-[16px] bg-white px-4 py-3">
                  <Text className="font-semibold text-slate-600">
                    This task will be assigned to {greetingName}
                  </Text>
                </View>
              ) : null}
            </View>

            <View className="flex-row justify-end pt-1" style={{ gap: 10 }}>
              <Pressable
                onPress={onClose}
                className="rounded-[16px] bg-slate-200 px-4 py-3"
                style={({ pressed }) =>
                  pressed
                    ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                    : undefined
                }
              >
                <Text className="font-extrabold text-slate-900">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={onSave}
                disabled={saving}
                className="rounded-[16px] bg-slate-900 px-4 py-3"
                style={({ pressed }) => [
                  pressed
                    ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                    : undefined,
                  saving ? { opacity: 0.75 } : null,
                ]}
              >
                <Text className="font-extrabold text-white">
                  {editingTaskId ? "Update" : "Create"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>

      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => onShowDatePickerChange(false)}
      >
        <View className="flex-1 items-center justify-center px-4">
          <Pressable
            className="absolute inset-0 bg-black/45"
            onPress={() => onShowDatePickerChange(false)}
          />
          <View
            className="w-full max-w-[420px] rounded-[28px] bg-white px-[18px] pb-[18px] pt-4"
            style={{ zIndex: 10, elevation: 10 }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[22px] font-black text-slate-900">
                Select Date
              </Text>
              <Pressable
                onPress={() => onShowDatePickerChange(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"
              >
                <Ionicons name="close" size={20} color="#0f172a" />
              </Pressable>
            </View>

            {Platform.OS === "web" ? (
              <View className="rounded-[20px] border border-slate-200 bg-white p-3">
                <PaperTextInput
                  mode="outlined"
                  label="YYYY-MM-DD"
                  value={webDateValue}
                  onChangeText={setWebDateValue}
                  placeholder=""
                  outlineColor="#dbe4ee"
                  activeOutlineColor="#94a3b8"
                  textColor="#0f172a"
                  theme={{ roundness: 8 }}
                  contentStyle={{ backgroundColor: "#fff" }}
                  style={{ backgroundColor: "#fff", borderRadius: 8 }}
                />
                <Text className="mt-2 text-xs font-medium text-slate-500">
                  Enter a date in YYYY-MM-DD format
                </Text>
              </View>
            ) : (
              <View
                className="rounded-[20px] border border-slate-200 bg-white p-2"
                style={{ minHeight: 320 }}
              >
                <DateTimePicker
                  value={deadline}
                  mode="date"
                  display="spinner"
                  onChange={handleNativeDateChange}
                  style={{ flex: 1 }}
                />
              </View>
            )}

            <View className="mt-4 flex-row justify-end" style={{ gap: 10 }}>
              <Pressable
                onPress={() => onShowDatePickerChange(false)}
                className="rounded-[16px] bg-slate-200 px-4 py-3"
                style={({ pressed }) =>
                  pressed
                    ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                    : undefined
                }
              >
                <Text className="font-extrabold text-slate-900">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={() => onShowDatePickerChange(false)}
                className="rounded-[16px] bg-slate-900 px-4 py-3"
                style={({ pressed }) =>
                  pressed
                    ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                    : undefined
                }
              >
                <Text className="font-extrabold text-white">Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMemberDropdown && hasGroupContext}
        transparent
        animationType="fade"
        onRequestClose={() => onMemberDropdownChange(false)}
      >
        <View className="flex-1 items-center justify-center px-4">
          <Pressable
            className="absolute inset-0 bg-black/45"
            onPress={() => onMemberDropdownChange(false)}
            style={{ zIndex: 0 }}
          />
          <View
            className="w-full rounded-[28px] bg-white px-[18px] pb-[18px] pt-3"
            style={{
              maxHeight: "86%",
              zIndex: 10,
              position: "relative",
              elevation: 10,
            }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[22px] font-black text-slate-900">
                Select Members
              </Text>
              <Pressable
                onPress={() => onMemberDropdownChange(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"
              >
                <Ionicons name="close" size={20} color="#0f172a" />
              </Pressable>
            </View>

            <View className="mb-3 rounded-2xl bg-slate-50 p-3">
              <PaperTextInput
                mode="outlined"
                label="Search members"
                value={memberSearch}
                onChangeText={setMemberSearch}
                placeholder=""
                outlineColor="#dbe4ee"
                activeOutlineColor="#94a3b8"
                textColor="#0f172a"
                left={<PaperTextInput.Icon icon="magnify" />}
                theme={{ roundness: 8 }}
                contentStyle={{ backgroundColor: "#fff" }}
                style={{ backgroundColor: "#fff", borderRadius: 8 }}
              />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 10, paddingBottom: 18 }}
            >
              {eligibleUsers.length === 0 ? (
                <Text className="font-semibold text-slate-500">
                  No eligible members found
                </Text>
              ) : filteredMembers.length === 0 ? (
                <Text className="font-semibold text-slate-500">
                  No matching members found
                </Text>
              ) : (
                filteredMembers.map((member) => {
                  const checked = selectedMemberIds.includes(member.id);
                  return (
                    <Pressable
                      key={member.id}
                      onPress={() => onMemberToggle(member.id)}
                      className={`flex-row items-center rounded-[16px] border p-3 ${
                        checked
                          ? "border-blue-200 bg-blue-50"
                          : "border-slate-200 bg-white"
                      }`}
                      style={({ pressed }) =>
                        pressed
                          ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                          : undefined
                      }
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                        <Ionicons name="person" size={18} color="#64748b" />
                      </View>

                      <View className="mx-3 flex-1">
                        <Text className="text-[15px] font-extrabold text-slate-900">
                          {member.name}
                        </Text>
                      </View>

                      <View
                        className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                          checked
                            ? "border-slate-900 bg-slate-900"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked ? (
                          <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

export function ListModal({
  visible,
  onClose,
  onSave,
  editingColumnId,
  listName,
  onListNameChange,
  columns,
  onMoveColumn,
  onDeleteList,
}: ListModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center px-4">
        <Pressable
          className="absolute inset-0 bg-black/45"
          onPress={onClose}
          style={{ zIndex: 0 }}
        />
        <View
          className="w-full rounded-[28px] bg-white px-[18px] pb-[18px] pt-3"
          style={{
            maxHeight: "90%",
            zIndex: 10,
            position: "relative",
            elevation: 10,
          }}
        >
          <Text className="mb-3 text-center text-[22px] font-black text-slate-900">
            {editingColumnId ? "Edit List" : "Add List"}
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          >
            <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 10 }}>
              <PaperTextInput
                mode="outlined"
                label="List name"
                value={listName}
                onChangeText={onListNameChange}
                placeholder=""
                outlineColor="#dbe4ee"
                activeOutlineColor="#94a3b8"
                textColor="#0f172a"
                theme={{ roundness: 8 }}
                contentStyle={{ backgroundColor: "#fff" }}
                style={{ backgroundColor: "#fff", borderRadius: 8 }}
              />
            </View>

            {editingColumnId ? (
              <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 8 }}>
                <Text className="text-[13px] font-extrabold text-slate-900">
                  Reorder Lists
                </Text>

                <View style={{ gap: 10 }}>
                  {columns.map((column, index) => (
                    <View
                      key={column.id}
                      className="flex-row items-center rounded-[16px] border border-slate-200 bg-white px-3 py-3"
                      style={{ gap: 8 }}
                    >
                      <Text className="flex-1 text-[14px] font-extrabold text-slate-900">
                        {column.label}
                      </Text>

                      <Pressable
                        onPress={() => onMoveColumn(index, -1)}
                        disabled={index === 0}
                        className={`h-9 w-9 items-center justify-center rounded-full ${
                          index === 0 ? "bg-slate-100" : "bg-slate-900"
                        }`}
                        style={({ pressed }) =>
                          pressed && index !== 0
                            ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                            : undefined
                        }
                      >
                        <Ionicons
                          name="chevron-up"
                          size={18}
                          color={index === 0 ? "#94a3b8" : "#ffffff"}
                        />
                      </Pressable>

                      <Pressable
                        onPress={() => onMoveColumn(index, 1)}
                        disabled={index === columns.length - 1}
                        className={`h-9 w-9 items-center justify-center rounded-full ${
                          index === columns.length - 1
                            ? "bg-slate-100"
                            : "bg-slate-900"
                        }`}
                        style={({ pressed }) =>
                          pressed && index !== columns.length - 1
                            ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                            : undefined
                        }
                      >
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={index === columns.length - 1 ? "#94a3b8" : "#ffffff"}
                        />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {editingColumnId ? (
              <Pressable
                onPress={onDeleteList}
                className="rounded-[16px] bg-red-500 px-4 py-3"
                style={({ pressed }) =>
                  pressed
                    ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                    : undefined
                }
              >
                <Text className="text-center font-extrabold text-white">
                  Delete List
                </Text>
              </Pressable>
            ) : null}

            <View className="flex-row justify-end pt-1" style={{ gap: 10 }}>
              <Pressable
                onPress={onClose}
                className="rounded-[16px] bg-slate-200 px-4 py-3"
                style={({ pressed }) =>
                  pressed
                    ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                    : undefined
                }
              >
                <Text className="font-extrabold text-slate-900">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={onSave}
                className="rounded-[16px] bg-slate-900 px-4 py-3"
                style={({ pressed }) =>
                  pressed
                    ? { opacity: 0.85, transform: [{ scale: 0.98 }] }
                    : undefined
                }
              >
                <Text className="font-extrabold text-white">
                  {editingColumnId ? "Update" : "Add"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function TaskActionMenuModal({
  visible,
  x,
  y,
  onClose,
  onEdit,
  onDelete,
}: TaskActionMenuModalProps) {
  const menuWidth = 176;

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(15, 23, 42, 0.12)",
        }}
        onPress={onClose}
      >
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: menuWidth,
            zIndex: 999999,
            elevation: 999999,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 18,
              borderWidth: 1,
              borderColor: "#e2e8f0",
              padding: 8,
              shadowColor: "#0f172a",
              shadowOpacity: 0.22,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 50,
            }}
          >
            <Pressable
              onPress={onEdit}
              className="flex-row items-center rounded-xl px-3 py-3"
              style={({ pressed }) => (pressed ? { opacity: 0.86 } : undefined)}
            >
              <Ionicons name="pencil-outline" size={18} color="#0f172a" />
              <Text selectable={false} className="ml-3 text-[13px] font-bold text-slate-900">
                Edit
              </Text>
            </Pressable>

            <Pressable
              onPress={onDelete}
              className="flex-row items-center rounded-xl px-3 py-3"
              style={({ pressed }) => (pressed ? { opacity: 0.86 } : undefined)}
            >
              <Ionicons name="trash-outline" size={18} color="#dc2626" />
              <Text selectable={false} className="ml-3 text-[13px] font-bold text-red-600">
                Delete
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

export function DeleteConfirmModal({
  visible,
  taskTitle,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 items-center justify-center px-4">
        <Pressable
          className="absolute inset-0 bg-black/45"
          onPress={onCancel}
        />
        <View
          className="w-full rounded-[28px] bg-white px-[18px] pb-[18px] pt-4"
          style={{ maxWidth: 420, zIndex: 10, elevation: 10 }}
        >
          <Text className="text-center text-[22px] font-black text-slate-900">
            Delete Task
          </Text>
          <Text className="mt-2 text-center text-[14px] font-medium text-slate-600">
            Are you sure you want to delete this task?
          </Text>
          {taskTitle ? (
            <Text className="mt-3 text-center text-[13px] font-bold text-slate-900">
              {taskTitle}
            </Text>
          ) : null}

          <View className="mt-5 flex-row justify-end" style={{ gap: 10 }}>
            <Pressable
              onPress={onCancel}
              className="rounded-[16px] bg-slate-200 px-4 py-3"
              style={({ pressed }) =>
                pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
              }
            >
              <Text className="font-extrabold text-slate-900">Cancel</Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              className="rounded-[16px] bg-red-500 px-4 py-3"
              style={({ pressed }) =>
                pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
              }
            >
              <Text className="font-extrabold text-white">Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default {
  TaskModal,
  ListModal,
  TaskActionMenuModal,
  DeleteConfirmModal,
};