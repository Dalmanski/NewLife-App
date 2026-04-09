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
  taskChecklist: ChecklistItem[];
  onChecklistItemChange: (index: number, text: string) => void;
  onChecklistItemRemove: (index: number) => void;
  onChecklistItemAdd: () => void;
  selectedMemberNames: string[];
  showMemberDropdown: boolean;
  onMemberDropdownChange: (show: boolean) => void;
  eligibleUsers: Array<{ id: string; name: string; role: string; ministry: string[]; coreGroup: string[] }>;
  selectedMemberIds: string[];
  onMemberToggle: (memberId: string) => void;
  hasGroupContext: boolean;
  hasMemberContext: boolean;
  greetingName: string;
  saving: boolean;
  formatDateDisplay: (date: Date) => string;
};

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

  useEffect(() => {
    if (!showMemberDropdown) {
      setMemberSearch("");
    }
  }, [showMemberDropdown]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return eligibleUsers;

    return eligibleUsers.filter((member) =>
      member.name.toLowerCase().includes(query)
    );
  }, [eligibleUsers, memberSearch]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/45" onPress={onClose} />
        <View className="max-h-[92%] rounded-t-[28px] bg-white px-[18px] pb-[18px] pt-2">
          <View className="mb-3 self-center h-[5px] w-[44px] rounded-full bg-slate-300" />
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
              <Text className="text-[13px] font-extrabold text-slate-900">Deadline</Text>
              <Pressable
                onPress={() => onShowDatePickerChange(true)}
                className="flex-row items-center rounded-[16px] border border-slate-200 bg-white px-4 py-3"
                style={({ pressed }) =>
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                }
              >
                <Ionicons name="calendar-outline" size={18} color="#111827" />
                <Text className="ml-2 text-[15px] font-bold text-slate-900">
                  {formatDateDisplay(deadline)}
                </Text>
              </Pressable>

              {showDatePicker ? (
                <DateTimePicker
                  value={deadline}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, selected) => {
                    if (Platform.OS !== "ios") {
                      onShowDatePickerChange(false);
                    }
                    if (selected) onDeadlineChange(selected);
                  }}
                />
              ) : null}
            </View>

            <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 8 }}>
              <Text className="text-[13px] font-extrabold text-slate-900">Column</Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {columns.map((column) => {
                  const active = selectedStatus === column.id;
                  return (
                    <Pressable
                      key={column.id}
                      onPress={() => onStatusChange(column.id)}
                      className={`rounded-full px-3 py-2 ${
                        active ? "bg-slate-900" : "bg-white"
                      }`}
                      style={({ pressed }) => [
                        pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined,
                        {
                          borderWidth: 1,
                          borderColor: active ? "#0f172a" : "#e2e8f0",
                        },
                      ]}
                    >
                      <Text
                        className={`text-xs font-extrabold ${
                          active ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {column.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 8 }}>
              <Text className="text-[13px] font-extrabold text-slate-900">Checklist</Text>

              {taskChecklist.map((item, index) => (
                <View key={index} className="mb-2 flex-row items-center" style={{ gap: 10 }}>
                  <PaperTextInput
                    mode="outlined"
                    label={`Checklist ${index + 1}`}
                    value={item.text}
                    onChangeText={(text) => onChecklistItemChange(index, text)}
                    placeholder=""
                    outlineColor="#dbe4ee"
                    activeOutlineColor="#94a3b8"
                    textColor="#0f172a"
                    theme={{ roundness: 8 }}
                    contentStyle={{ backgroundColor: "#fff" }}
                    style={{ flex: 1, backgroundColor: "#fff", borderRadius: 8 }}
                  />
                  <Pressable
                    onPress={() => onChecklistItemRemove(index)}
                    className="h-10 w-10 items-center justify-center rounded-[14px] bg-red-500"
                    style={({ pressed }) =>
                      pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
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
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                }
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text className="ml-2 font-bold text-white">Add checklist item</Text>
              </Pressable>
            </View>

            <View className="rounded-2xl bg-slate-50 p-3" style={{ gap: 8 }}>
              <Text className="text-[13px] font-extrabold text-slate-900">Assign Members</Text>

              <Pressable
                onPress={() => onMemberDropdownChange(true)}
                className="flex-row items-center justify-between rounded-[16px] border border-slate-200 bg-white px-4 py-3"
                style={({ pressed }) =>
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
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
                      <Text className="text-xs font-bold text-slate-900">{name}</Text>
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
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                }
              >
                <Text className="font-extrabold text-slate-900">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={onSave}
                disabled={saving}
                className="rounded-[16px] bg-slate-900 px-4 py-3"
                style={({ pressed }) => [
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined,
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
        visible={showMemberDropdown && hasGroupContext}
        transparent
        animationType="fade"
        onRequestClose={() => onMemberDropdownChange(false)}
      >
        <View className="flex-1 justify-end">
          <Pressable
            className="absolute inset-0 bg-black/45"
            onPress={() => onMemberDropdownChange(false)}
          />
          <View className="max-h-[86%] rounded-t-[28px] bg-white px-[18px] pb-[18px] pt-2">
            <View className="mb-3 self-center h-[5px] w-[44px] rounded-full bg-slate-300" />
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[22px] font-black text-slate-900">Select Members</Text>
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
                <Text className="font-semibold text-slate-500">No eligible members found</Text>
              ) : filteredMembers.length === 0 ? (
                <Text className="font-semibold text-slate-500">No matching members found</Text>
              ) : (
                filteredMembers.map((member) => {
                  const checked = selectedMemberIds.includes(member.id);
                  return (
                    <Pressable
                      key={member.id}
                      onPress={() => onMemberToggle(member.id)}
                      className={`flex-row items-center rounded-[16px] border p-3 ${
                        checked ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"
                      }`}
                      style={({ pressed }) =>
                        pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
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
                          checked ? "border-slate-900 bg-slate-900" : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
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
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/45" onPress={onClose} />
        <View className="max-h-[88%] rounded-t-[28px] bg-white px-[18px] pb-[18px] pt-2">
          <View className="mb-3 self-center h-[5px] w-[44px] rounded-full bg-slate-300" />
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
                <Text className="text-[13px] font-extrabold text-slate-900">Reorder Lists</Text>

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
                          index === columns.length - 1 ? "bg-slate-100" : "bg-slate-900"
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
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                }
              >
                <Text className="text-center font-extrabold text-white">Delete List</Text>
              </Pressable>
            ) : null}

            <View className="flex-row justify-end pt-1" style={{ gap: 10 }}>
              <Pressable
                onPress={onClose}
                className="rounded-[16px] bg-slate-200 px-4 py-3"
                style={({ pressed }) =>
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                }
              >
                <Text className="font-extrabold text-slate-900">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={onSave}
                className="rounded-[16px] bg-slate-900 px-4 py-3"
                style={({ pressed }) =>
                  pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
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

export default { TaskModal, ListModal };