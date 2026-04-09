import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

type UserOption = {
  id: string;
  name: string;
  role: string;
  joinedGroups: string[];
  joinedText: string;
};

type SubgroupItem = {
  id: string;
  name: string;
  leaderId?: string;
  leaderName?: string;
  leaderRole?: string;
  memberIds: string[];
  memberNames: string[];
};

type GroupItem = {
  id: string;
  name: string;
  description?: string;
  leaderId?: string;
  leaderName?: string;
  leaderRole?: string;
  createdAt?: any;
  isActive?: boolean;
  kind: "ministry" | "coreGroup";
  subgroups: SubgroupItem[];
};

type PickerMode = "newSubgroupLeader" | "newSubgroupMembers" | "existingSubgroupMembers";

type NewSubgroupModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreate: () => Promise<void>;
  group: GroupItem | null;
  newSubgroupLeaderId: string;
  newSubgroupMemberIds: string[];
  userMap: Map<string, UserOption>;
  onOpenUserPicker: (mode: PickerMode) => void;
  selectedLeader: UserOption | null | undefined;
  savingAction: boolean;
  indexToLetters: (index: number) => string;
};

export function NewSubgroupModal({
  visible,
  onClose,
  onCreate,
  group,
  newSubgroupLeaderId,
  newSubgroupMemberIds,
  userMap,
  onOpenUserPicker,
  selectedLeader,
  savingAction,
  indexToLetters,
}: NewSubgroupModalProps) {
  if (!group) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/45 px-5">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="w-full max-w-[520px] max-h-[86%] overflow-hidden rounded-[28px] bg-white shadow-lg">
          <View className="bg-gray-900 px-5 py-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Ionicons name="people" size={22} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-[18px] font-extrabold text-white">Add Subgroup</Text>
                <Text className="mt-0.5 text-[13px] font-semibold text-white/70">
                  {`Group ${indexToLetters(group.subgroups.length)}`}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
              >
                <Ionicons name="close" size={22} color="white" />
              </Pressable>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="px-5 py-5 gap-4"
          >
            <View className="rounded-[20px] border border-gray-200 bg-gray-50 p-4">
              <Text className="text-[13px] font-extrabold text-gray-500">Leader</Text>
              <Pressable
                onPress={() => onOpenUserPicker("newSubgroupLeader")}
                className="mt-2 flex-row items-center justify-between gap-2 rounded-[16px] border border-gray-200 bg-white px-4 py-3"
              >
                <View className="flex-1">
                  <Text
                    className={`text-[15px] font-semibold ${
                      newSubgroupLeaderId ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {newSubgroupLeaderId ? userMap.get(newSubgroupLeaderId)?.name ?? "Select leader" : "Select leader"}
                  </Text>
                  {!!selectedLeader && (
                    <Text className="mt-1 text-[12px] font-semibold text-gray-500">
                      {selectedLeader.role || "No role"}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </Pressable>
            </View>

            <View className="rounded-[20px] border border-gray-200 bg-white p-4">
              <Text className="text-[13px] font-extrabold text-gray-500">Members</Text>

              <Pressable
                onPress={() => onOpenUserPicker("newSubgroupMembers")}
                className="mt-3 flex-row items-center justify-between gap-2 rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <Text
                  className={`flex-1 text-[15px] font-semibold ${
                    newSubgroupMemberIds.length > 0 ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  {newSubgroupMemberIds.length > 0
                    ? `${newSubgroupMemberIds.length} selected`
                    : "Select members"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </Pressable>

              {newSubgroupMemberIds.length > 0 ? (
                <View className="mt-3 gap-2">
                  {newSubgroupMemberIds.map((memberId) => (
                    <View
                      key={memberId}
                      className="flex-row items-center gap-3 rounded-[14px] border border-gray-200 bg-[#FAFAFA] px-3 py-2.5"
                    >
                      <View className="h-8 w-8 items-center justify-center rounded-full bg-gray-200">
                        <Ionicons name="person" size={16} color="#6B7280" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[14px] font-bold text-gray-900">
                          {userMap.get(memberId)?.name ?? "Unnamed"}
                        </Text>
                        <Text className="text-[12px] font-semibold text-gray-500">
                          {userMap.get(memberId)?.role || "No role"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View className="flex-row items-center justify-end gap-2.5 pt-1">
              <Pressable onPress={onClose} className="rounded-[14px] bg-gray-200 px-4 py-3">
                <Text className="font-extrabold text-gray-900">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={onCreate}
                disabled={savingAction}
                className={`rounded-[14px] bg-gray-900 px-4 py-3 ${savingAction ? "opacity-75" : ""}`}
              >
                <Text className="font-extrabold text-white">{savingAction ? "Saving..." : "Create"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type AddMembersModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  activeSubgroup: SubgroupItem | null;
  memberSelectionIds: string[];
  userMap: Map<string, UserOption>;
  onOpenUserPicker: (mode: PickerMode, subgroupIndex?: number | null) => void;
  savingAction: boolean;
  editSubgroupLeaderId: string;
  onEditLeaderClick: () => void;
};

export function AddMembersModal({
  visible,
  onClose,
  onSave,
  activeSubgroup,
  memberSelectionIds,
  userMap,
  onOpenUserPicker,
  savingAction,
  editSubgroupLeaderId,
  onEditLeaderClick,
}: AddMembersModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/45 px-5">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="w-full max-w-[520px] max-h-[86%] overflow-hidden rounded-[28px] bg-white shadow-lg">
          <View className="bg-gray-900 px-5 py-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Ionicons name="person-add" size={22} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-[18px] font-extrabold text-white">Manage Members</Text>
                <Text className="mt-0.5 text-[13px] font-semibold text-white/70">
                  {activeSubgroup?.name ?? "Subgroup"}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
              >
                <Ionicons name="close" size={22} color="white" />
              </Pressable>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="px-5 py-5 gap-4"
          >
            <View className="rounded-[20px] border border-gray-200 bg-gray-50 p-4">
              <Text className="text-[13px] font-extrabold text-gray-500">Leader</Text>
              <Pressable
                onPress={onEditLeaderClick}
                className="mt-2 flex-row items-center justify-between gap-2 rounded-[16px] border border-gray-200 bg-white px-4 py-3"
              >
                <View className="flex-1">
                  <Text
                    className={`text-[15px] font-semibold ${
                      editSubgroupLeaderId ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {editSubgroupLeaderId ? userMap.get(editSubgroupLeaderId)?.name ?? "Select leader" : "Select leader"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </Pressable>
            </View>

            <View className="rounded-[20px] border border-gray-200 bg-white p-4">
              <Text className="text-[13px] font-extrabold text-gray-500">Members</Text>

              <Pressable
                onPress={() => onOpenUserPicker("existingSubgroupMembers")}
                className="mt-3 flex-row items-center justify-between gap-2 rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <Text
                  className={`flex-1 text-[15px] font-semibold ${
                    memberSelectionIds.length > 0 ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  {memberSelectionIds.length > 0
                    ? `${memberSelectionIds.length} selected`
                    : "Select members"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </Pressable>

              {memberSelectionIds.length > 0 ? (
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {memberSelectionIds.map((memberId) => (
                    <View
                      key={memberId}
                      className="flex-row items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2"
                    >
                      <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                        <Ionicons name="person" size={13} color="#2563EB" />
                      </View>
                      <Text className="max-w-[150px] text-[13px] font-bold text-gray-900" numberOfLines={1}>
                        {userMap.get(memberId)?.name ?? "Unnamed"}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View className="flex-row items-center justify-end gap-2.5 pt-1">
              <Pressable onPress={onClose} className="rounded-[14px] bg-gray-200 px-4 py-3">
                <Text className="font-extrabold text-gray-900">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={onSave}
                disabled={savingAction}
                className={`rounded-[14px] bg-gray-900 px-4 py-3 ${savingAction ? "opacity-75" : ""}`}
              >
                <Text className="font-extrabold text-white">{savingAction ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type UserPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pickerMode: PickerMode;
  pickerSearch: string;
  onPickerSearchChange: (text: string) => void;
  filteredUsers: UserOption[];
  pickerSelectedIds: string[];
  pickerBlockedIds: Set<string>;
  onToggleUser: (userId: string) => void;
  selectedPickerTitle: string;
  pickerSelectedUsers: UserOption[];
};

export function UserPickerModal({
  visible,
  onClose,
  onConfirm,
  pickerMode,
  pickerSearch,
  onPickerSearchChange,
  filteredUsers,
  pickerSelectedIds,
  pickerBlockedIds,
  onToggleUser,
  selectedPickerTitle,
  pickerSelectedUsers,
}: UserPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/45 px-5">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="w-full max-w-[560px] max-h-[88%] overflow-hidden rounded-[28px] bg-white shadow-lg">
          <View className="bg-gray-900 px-5 py-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Ionicons name={pickerMode === "newSubgroupLeader" ? "person" : "people"} size={22} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-[18px] font-extrabold text-white">{selectedPickerTitle}</Text>
                <Text className="mt-0.5 text-[13px] font-semibold text-white/70">
                  {pickerMode === "newSubgroupLeader"
                    ? "Choose exactly one leader"
                    : "Pick the people you want to include"}
                </Text>
              </View>
              <Pressable onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <Ionicons name="close" size={22} color="white" />
              </Pressable>
            </View>
          </View>

          <View className="px-5 pt-5">
            <View className="mb-3 flex-row h-[52px] items-center gap-2.5 rounded-[16px] border border-gray-200 bg-white px-4">
              <Ionicons name="search" size={18} color="#6B7280" />
              <TextInput
                value={pickerSearch}
                onChangeText={onPickerSearchChange}
                placeholder="Search users"
                placeholderTextColor="#9CA3AF"
                scrollEnabled={false}
                multiline={false}
                textAlignVertical="center"
                className="flex-1 min-w-0 text-[15px] text-gray-900"
                style={{
                  paddingVertical: 0,
                  includeFontPadding: false,
                }}
              />
            </View>

            {pickerSelectedUsers.length > 0 && pickerMode !== "newSubgroupLeader" ? (
              <View className="mb-3 rounded-[16px] border border-blue-100 bg-blue-50 px-4 py-3">
                <Text className="mb-2 text-[12px] font-extrabold uppercase tracking-[1px] text-blue-700">
                  Selected
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {pickerSelectedUsers.map((user) => (
                    <View
                      key={user.id}
                      className="flex-row items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-2"
                    >
                      <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                        <Ionicons name="person" size={13} color="#2563EB" />
                      </View>
                      <Text className="max-w-[180px] text-[12px] font-bold text-gray-900" numberOfLines={1}>
                        {user.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="px-5 pb-4 gap-2.5"
          >
            {filteredUsers.length === 0 ? (
              <Text className="py-5 text-center text-gray-500">No users found</Text>
            ) : (
              filteredUsers.map((user) => {
                const active = pickerSelectedIds.includes(user.id);
                const disabled = pickerBlockedIds.has(user.id) && !active;

                return (
                  <Pressable
                    key={user.id}
                    onPress={() => {
                      if (disabled) return;
                      onToggleUser(user.id);
                    }}
                    className={`flex-row items-center gap-3 rounded-[16px] border p-3 ${
                      disabled
                        ? "border-gray-100 bg-gray-50 opacity-50"
                        : active
                          ? "border-blue-200 bg-blue-50"
                          : "border-gray-200 bg-white"
                    }`}
                  >
                    <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-gray-100">
                      <Ionicons name="person" size={18} color="#9CA3AF" />
                    </View>

                    <View className="flex-1">
                      <Text className="text-[15px] font-extrabold text-gray-900">{user.name}</Text>
                      {!!user.joinedText && (
                        <Text className="mt-0.5 text-[13px] font-semibold text-gray-500">
                          {user.joinedText}
                        </Text>
                      )}
                    </View>

                    {pickerMode === "newSubgroupLeader" ? (
                      active ? (
                        <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                      ) : (
                        <Ionicons name="ellipse-outline" size={22} color="#9CA3AF" />
                      )
                    ) : active ? (
                      <Ionicons name="checkbox" size={22} color="#16A34A" />
                    ) : (
                      <Ionicons name="square-outline" size={22} color="#9CA3AF" />
                    )}
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View className="flex-row items-center justify-end gap-2.5 px-5 pb-5 pt-2">
            <Pressable onPress={onClose} className="rounded-[14px] bg-gray-200 px-4 py-3">
              <Text className="font-extrabold text-gray-900">Close</Text>
            </Pressable>

            <Pressable onPress={onConfirm} className="rounded-[14px] bg-gray-900 px-4 py-3">
              <Text className="font-extrabold text-white">
                {pickerMode === "newSubgroupLeader" ? "Select" : "Done"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type EditGroupModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  group: GroupItem | null;
  editName: string;
  onEditNameChange: (text: string) => void;
  editDescription: string;
  onEditDescriptionChange: (text: string) => void;
  editLeaderId: string;
  userMap: Map<string, UserOption>;
  onOpenUserPicker: () => void;
  selectedEditLeader: UserOption | null | undefined;
  savingAction: boolean;
};

export function EditGroupModal({
  visible,
  onClose,
  onSave,
  group,
  editName,
  onEditNameChange,
  editDescription,
  onEditDescriptionChange,
  editLeaderId,
  userMap,
  onOpenUserPicker,
  selectedEditLeader,
  savingAction,
}: EditGroupModalProps) {
  if (!group) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/45 px-5">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="w-full max-w-[520px] max-h-[86%] overflow-hidden rounded-[28px] bg-white shadow-lg">
          <View className="bg-gray-900 px-5 py-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Ionicons name="create" size={22} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-[18px] font-extrabold text-white">Edit Group</Text>
                <Text className="mt-0.5 text-[13px] font-semibold text-white/70">
                  {group.name}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
              >
                <Ionicons name="close" size={22} color="white" />
              </Pressable>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="px-5 py-5 gap-4"
          >
            <View className="rounded-[20px] border border-gray-200 bg-gray-50 p-4">
              <Text className="text-[13px] font-extrabold text-gray-500">Group Name</Text>
              <TextInput
                value={editName}
                onChangeText={onEditNameChange}
                placeholder="Enter group name"
                placeholderTextColor="#9CA3AF"
                className="mt-2 rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-[15px] font-semibold text-gray-900"
              />
            </View>

            <View className="rounded-[20px] border border-gray-200 bg-white p-4">
              <Text className="text-[13px] font-extrabold text-gray-500">Description</Text>
              <TextInput
                value={editDescription}
                onChangeText={onEditDescriptionChange}
                placeholder="Enter group description"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                className="mt-2 rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] font-semibold text-gray-900"
              />
            </View>

            <View className="rounded-[20px] border border-gray-200 bg-gray-50 p-4">
              <Text className="text-[13px] font-extrabold text-gray-500">Head Ministry (Leader)</Text>
              <Pressable
                onPress={onOpenUserPicker}
                className="mt-2 flex-row items-center justify-between gap-2 rounded-[16px] border border-gray-200 bg-white px-4 py-3"
              >
                <View className="flex-1">
                  <Text
                    className={`text-[15px] font-semibold ${
                      editLeaderId ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {editLeaderId ? userMap.get(editLeaderId)?.name ?? "Select leader" : "Select leader"}
                  </Text>
                  {!!selectedEditLeader && (
                    <Text className="mt-1 text-[12px] font-semibold text-gray-500">
                      {selectedEditLeader.role || "No role"}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </Pressable>
            </View>

            <View className="flex-row items-center justify-end gap-2.5 pt-1">
              <Pressable onPress={onClose} className="rounded-[14px] bg-gray-200 px-4 py-3">
                <Text className="font-extrabold text-gray-900">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={onSave}
                disabled={savingAction}
                className={`rounded-[14px] bg-gray-900 px-4 py-3 ${savingAction ? "opacity-75" : ""}`}
              >
                <Text className="font-extrabold text-white">{savingAction ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default { NewSubgroupModal, AddMembersModal, UserPickerModal, EditGroupModal };
