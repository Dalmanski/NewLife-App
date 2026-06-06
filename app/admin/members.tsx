import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { db } from "../../lib/firebaseConfig";
import {
  NewSubgroupModal,
  AddMembersModal,
  UserPickerModal,
  EditGroupModal,
  DeleteConfirmModal,
  useModalFunctions,
} from "./members-modal";

type UserOption = {
  id: string;
  name: string;
  role: string;
  gender?: string;
  joinedGroups: string[];
  joinedText: string;
  profileImageUrl?: string;
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

type MemberCard = {
  id: string;
  name: string;
  gender?: string;
  registered: boolean;
};

type GroupItem = {
  id: string;
  name: string;
  description?: string;
  leaderId?: string;
  leaderName?: string;
  leaderRole?: string;
  createdAt?: Timestamp | string | null;
  isActive?: boolean;
  ministryType?: string;
  members: MemberCard[];
  subgroups: SubgroupItem[];
};

type PickerMode =
  | "newSubgroupLeader"
  | "newSubgroupMembers"
  | "existingSubgroupMembers"
  | "directMembers";

type SubGroupAssignment = {
  groupId: string;
  groupName: string;
  subgroupId: string;
  subgroupName: string;
  leaderId: string;
  leaderName: string;
  leaderRole: string;
};

const DEFAULT_GROUP_ID = "seed-care-group";
const DEFAULT_GROUP_NAME = "Care Group";
const PLACEHOLDER_PFP_MALE = require("../../assets/images/placeholder-pfp.avif");
const PLACEHOLDER_PFP_FEMALE = require("../../assets/images/placeholder-pfp-female.jpg");
const PLACEHOLDER_PFP_UNKNOWN = require("../../assets/images/placeholder-pfp-unknown.jpg");

const normalizeIds = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));

const getMemberName = (raw: any) => {
  return String(raw?.name ?? raw?.fullName ?? raw?.memberName ?? raw?.username ?? raw?.email ?? "Unnamed");
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

const makeLocalId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const indexToLetters = (index: number) => {
  let n = index;
  let result = "";
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
};

const getCollectionName = () => "ministries";

const getAnyId = (value: any) => {
  if (typeof value === "string") return value.trim();
  return String(value?.id ?? value?.memberId ?? value?.userId ?? value?.uid ?? "").trim();
};

const normalizeText = (value: any) => String(value ?? "").trim().toLowerCase();

const extractMinistryNames = (value: any) => {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items
    .map((item) => {
      if (!item) return "";
      if (typeof item === "string") return String(item).trim();
      if (typeof item === "object") {
        return String(item.groupName ?? item.subgroupName ?? item.name ?? item.label ?? item.title ?? "").trim();
      }
      return String(item).trim();
    })
    .filter(Boolean);
};

const getUserMinistryNames = (raw: any) => {
  const names = [...extractMinistryNames(raw?.ministry), ...extractMinistryNames(raw?.subGroup?.ministry)];
  return Array.from(new Set(names));
};

const userMatchesMinistry = (raw: any, matchers: Set<string>) => {
  if (!matchers.size) return true;
  const names = getUserMinistryNames(raw);
  return names.some((name) => matchers.has(normalizeText(name)));
};

function SquarePersonTile({
  name,
  gender,
  registered,
  showStatus,
  onPress,
  compact = false,
  profileImageUrl,
}: {
  name: string;
  gender?: string;
  registered: boolean;
  showStatus: boolean;
  onPress?: () => void;
  compact?: boolean;
  profileImageUrl?: string;
}) {
  const titleSize = compact ? "text-[13px]" : "text-[15px]";
  const statusSize = compact ? "text-[9px]" : "text-[10px]";

  const placeholderPfp =
    gender === "female"
      ? PLACEHOLDER_PFP_FEMALE
      : gender === "male"
        ? PLACEHOLDER_PFP_MALE
        : PLACEHOLDER_PFP_UNKNOWN;

  const imageSource = profileImageUrl ? { uri: profileImageUrl } : placeholderPfp;

  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-[18px] border border-gray-200 bg-white"
      style={{ aspectRatio: 1 }}
    >
      <View className="flex-1 p-2">
        <View style={{ flex: 1 }}>
          <View className="w-full flex-1 overflow-hidden rounded-2xl bg-gray-100">
            <Image
              source={imageSource}
              resizeMode="cover"
              style={{
                width: "100%",
                height: "100%",
              }}
            />
          </View>

          <View
            className="w-full items-center justify-center rounded-lg bg-white px-1 pt-2"
            style={{
              minHeight: compact ? 42 : 48,
            }}
          >
            <Text
              numberOfLines={2}
              ellipsizeMode="tail"
              allowFontScaling={true}
              className={`text-center font-extrabold text-gray-900 ${titleSize}`}
              style={{
                includeFontPadding: false,
                textAlignVertical: "center",
                lineHeight: compact ? 15 : 18,
                width: "100%",
              }}
            >
              {name}
            </Text>

            {showStatus ? (
              <View className="mt-1 flex-row items-center gap-1">
                <Ionicons
                  name={registered ? "checkmark-circle" : "alert-circle"}
                  size={compact ? 12 : 13}
                  color={registered ? "#16A34A" : "#D97706"}
                />
                <Text className={`font-bold ${registered ? "text-emerald-600" : "text-amber-600"} ${statusSize}`}>
                  {registered ? "Registered" : "Unregistered"}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function Members() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const params = useLocalSearchParams<{
    groupId?: string;
    groupName?: string;
  }>();

  const groupId = String(params.groupId ?? "");
  const groupNameParam = String(params.groupName ?? "");

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<GroupItem | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [savingAction, setSavingAction] = useState(false);

  const [showSubgroupMenu, setShowSubgroupMenu] = useState(false);
  const [subgroupMenuTargetIndex, setSubgroupMenuTargetIndex] = useState<number | null>(null);
  const [subgroupMenuAnchor, setSubgroupMenuAnchor] = useState<{ left: number; top: number } | null>(null);

  const subgroupMenuRefs = useRef<Record<string, View | null>>({});
  const [contentWidth, setContentWidth] = useState(0);

  const isSeedCareGroup =
    groupId === DEFAULT_GROUP_ID || groupNameParam.trim().toLowerCase() === DEFAULT_GROUP_NAME.toLowerCase();

  const loadData = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const groupRef = doc(db, getCollectionName(), groupId);
      const [groupSnap, usersSnap] = await Promise.all([getDoc(groupRef), getDocs(collection(db, "users"))]);

      const baseData = (() => {
        if (groupSnap.exists()) {
          return groupSnap.data() as any;
        }

        if (isSeedCareGroup) {
          return {
            name: groupNameParam || DEFAULT_GROUP_NAME,
            description: "",
            leaderId: "",
            leaderName: "",
            leaderRole: "",
            createdAt: Timestamp.now(),
            isActive: false,
            ministryType: "members",
            members: [],
            subgroups: [],
          };
        }

        return null;
      })();

      if (!baseData) {
        setGroup(null);
        setUsers([]);
        return;
      }

      if (!groupSnap.exists() && isSeedCareGroup) {
        await setDoc(
          groupRef,
          {
            ...baseData,
            isActive: false,
            ministryType: String(baseData?.ministryType ?? "members").trim().toLowerCase(),
          },
          { merge: true }
        );
      }

      const ministryScopeCandidates = normalizeIds([String(baseData?.name ?? ""), String(groupNameParam ?? ""), String(groupId ?? "")].map((x) => x.trim()));
      const ministryMatchers = new Set(ministryScopeCandidates.map((x) => x.toLowerCase()));

      const allUsersLookup = new Map(
        usersSnap.docs.map((d) => {
          const raw = d.data() as any;
          return [
            d.id,
            {
              id: d.id,
              name: getMemberName(raw),
              role: String(raw?.role ?? ""),
              gender: String(raw?.gender ?? ""),
              joinedGroups: [],
              joinedText: "",
            },
          ];
        })
      );

      const userData: UserOption[] = usersSnap.docs
        .map((d) => {
          const raw = d.data() as any;
          const allMinistries = getUserMinistryNames(raw);
          const joinedGroups = normalizeIds(allMinistries);

          return {
            id: d.id,
            name: getMemberName(raw),
            role: String(raw?.role ?? ""),
            gender: String(raw?.gender ?? ""),
            joinedGroups,
            joinedText: joinedGroups.join(", "),
            raw,
          };
        })
        .filter((user: any) => userMatchesMinistry(user.raw, ministryMatchers))
        .map(({ raw, ...user }: any) => user)
        .sort((a, b) => a.name.localeCompare(b.name));

      const allMembersFromUsers: MemberCard[] = userData.map((user) => ({
        id: user.id,
        name: user.name,
        gender: user.gender,
        registered: true,
      }));

      const userLookup = new Map(userData.map((u) => [u.id, u]));

      const rawSubgroups = Array.isArray(baseData?.subgroups) ? baseData.subgroups : [];
      const parsedSubgroups: SubgroupItem[] = rawSubgroups.map((subgroup: any, index: number) => {
        const leaderId = String(subgroup?.leaderId ?? "");
        const memberIds = normalizeIds(Array.isArray(subgroup?.memberIds) ? subgroup.memberIds.map((x: any) => String(x)) : []).filter(
          (id) => id !== leaderId && id !== String(baseData?.leaderId ?? "")
        );

        const storedMemberNames = Array.isArray(subgroup?.memberNames)
          ? subgroup.memberNames.map((x: any) => String(x)).filter(Boolean)
          : [];

        const memberNames = memberIds.map(
          (memberId: string, memberIndex: number) => allUsersLookup.get(memberId)?.name ?? storedMemberNames[memberIndex] ?? "Unnamed"
        );

        return {
          id: String(subgroup?.id ?? `${groupId}-${index}`),
          name: String(subgroup?.name ?? `Group ${indexToLetters(index)}`),
          leaderId,
          leaderName: String(subgroup?.leaderName ?? ""),
          leaderRole: String(subgroup?.leaderRole ?? ""),
          memberIds,
          memberNames,
        };
      });

      const subgroupMemberIds = normalizeIds(parsedSubgroups.flatMap((subgroup) => subgroup.memberIds ?? []));
      const subgroupLeaderIds = normalizeIds(parsedSubgroups.map((subgroup) => subgroup.leaderId ?? "").filter(Boolean));

      const rawMembers = Array.isArray(baseData?.members) ? baseData.members : baseData?.memberId ? [baseData.memberId] : [];
      const directMemberIds = normalizeIds(rawMembers.map((item: any) => getAnyId(item))).filter(
        (id) => id && id !== String(baseData?.leaderId ?? "") && !subgroupMemberIds.includes(id) && !subgroupLeaderIds.includes(id)
      );

      const directMembers: MemberCard[] = directMemberIds.map((memberId) => ({
        id: memberId,
        name: allUsersLookup.get(memberId)?.name ?? "Unnamed",
        gender: allUsersLookup.get(memberId)?.gender,
        registered: Boolean(allUsersLookup.get(memberId)),
      }));

      const parsedGroup: GroupItem = {
        id: groupSnap.exists() ? groupSnap.id : groupId,
        name: String(baseData?.name ?? groupNameParam ?? "").trim(),
        description: String(baseData?.description ?? "").trim(),
        leaderId: String(baseData?.leaderId ?? ""),
        leaderName: String(baseData?.leaderName ?? ""),
        leaderRole: String(baseData?.leaderRole ?? ""),
        createdAt: baseData?.createdAt,
        isActive: baseData?.isActive ?? false,
        ministryType: String(baseData?.ministryType ?? "members").trim().toLowerCase(),
        members: directMembers,
        subgroups: parsedSubgroups,
      };

      setGroup(parsedGroup);
      setUsers(userData);

      const allUsersData: UserOption[] = usersSnap.docs
        .map((d) => {
          const raw = d.data() as any;
          const allMinistries = getUserMinistryNames(raw);
          const joinedGroups = normalizeIds(allMinistries);
          return {
            id: d.id,
            name: getMemberName(raw),
            role: String(raw?.role ?? ""),
            gender: String(raw?.gender ?? ""),
            joinedGroups,
            joinedText: joinedGroups.join(", "),
            profileImageUrl: String(raw?.profileImageUrl ?? ""),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      setAllUsers(allUsersData);
    } catch (error) {
      Alert.alert("Error", `Failed to load members\n${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [groupId, groupNameParam, isSeedCareGroup]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const allUsersMap = useMemo(() => new Map(allUsers.map((user) => [user.id, user])), [allUsers]);

  const ministryType = String(group?.ministryType ?? "members").trim().toLowerCase();
  const showMembersSection = ministryType === "members" || ministryType === "all" || !ministryType;
  const showGroupsSection = ministryType === "groups" || ministryType === "all" || !ministryType;
  const showStatusLabels = !Boolean(group?.isActive);
  const showSummaryBoxes = !Boolean(group?.isActive);

  const uniqueMemberIds = useMemo(() => {
    if (!group) return [];
    return normalizeIds([...group.members.map((member) => member.id), ...group.subgroups.flatMap((subgroup) => subgroup.memberIds ?? [])]);
  }, [group]);

  const subgroupBlocks = useMemo(() => {
    if (!group) return [];

    return group.subgroups.map((subgroup) => {
      const members: MemberCard[] = subgroup.memberIds.map((memberId, index) => {
        const user = allUsersMap.get(memberId);
        return {
          id: memberId,
          name: user?.name ?? subgroup.memberNames[index] ?? "Unnamed",
          gender: user?.gender,
          registered: Boolean(userMap.get(memberId)),
        };
      });

      return {
        ...subgroup,
        members,
      };
    });
  }, [group, allUsersMap, userMap]);

  const directMemberBlocks = useMemo(() => {
    if (!group) return [];
    return group.members.map((member) => ({
      ...member,
      name: allUsersMap.get(member.id)?.name ?? member.name ?? "Unnamed",
      gender: allUsersMap.get(member.id)?.gender,
      registered: Boolean(userMap.get(member.id)) || member.registered,
    }));
  }, [group, allUsersMap, userMap]);

  const registeredCount = useMemo(() => {
    return uniqueMemberIds.filter((id) => userMap.has(id)).length;
  }, [uniqueMemberIds, userMap]);

  const unregisteredCount = useMemo(() => {
    return uniqueMemberIds.filter((id) => !userMap.has(id)).length;
  }, [uniqueMemberIds, userMap]);

  const getBlockedIds = useCallback(
    (excludeSubgroupIndex: number | null, isDirect: boolean = false) => {
      const ids = new Set<string>();

      if (group?.leaderId) {
        ids.add(group.leaderId);
      }

      if (!group) return ids;

      if (isDirect) {
        group.members.forEach((member) => {
          if (member.id) ids.add(member.id);
        });
      } else {
        group.subgroups.forEach((subgroup, index) => {
          if (subgroup.leaderId) {
            ids.add(subgroup.leaderId);
          }

          if (excludeSubgroupIndex === null || index !== excludeSubgroupIndex) {
            subgroup.memberIds.forEach((memberId) => ids.add(memberId));
          }
        });
      }

      return ids;
    },
    [group]
  );

  const modal = useModalFunctions({
    group,
    users,
    loadData,
    getBlockedIds,
    groupId,
    groupNameParam,
    setSavingAction,
  });

  const {
    showNewSubgroupModal,
    setShowNewSubgroupModal,
    showAddMembersModal,
    setShowAddMembersModal,
    showUserPickerModal,
    setShowUserPickerModal,
    showEditGroupModal,
    setShowEditGroupModal,
    showDeleteConfirmModal,
    setShowDeleteConfirmModal,
    newSubgroupLeaderId,
    setNewSubgroupLeaderId,
    newSubgroupMemberIds,
    setNewSubgroupMemberIds,
    targetSubgroupIndex,
    setTargetSubgroupIndex,
    memberSelectionIds,
    setMemberSelectionIds,
    editSubgroupLeaderId,
    setEditSubgroupLeaderId,
    deleteConfirmIndex,
    setDeleteConfirmIndex,
    editName,
    setEditName,
    editDescription,
    setEditDescription,
    editLeaderId,
    setEditLeaderId,
    pickerMode,
    setPickerMode,
    pickerTargetIndex,
    setPickerTargetIndex,
    pickerSearch,
    setPickerSearch,
    pickerSelectedIds,
    setPickerSelectedIds,
    editPickerMode,
    setEditPickerMode,
    openCreateSubgroupModal,
    closeNewSubgroupModal,
    openAddMembersModal,
    closeAddMembersModal,
    openEditGroupModal,
    closeEditGroupModal,
    openUserPicker,
    closeUserPicker,
    togglePickerUser,
    confirmUserPicker,
    openEditSubgroupLeaderPicker,
    openEditLeaderPicker,
    createSubgroup,
    saveMembersToSubgroup,
    saveEditGroup,
    deleteSelectedSubgroup,
    confirmDelete,
  } = modal;

  const activeSubgroup = useMemo(() => {
    if (targetSubgroupIndex === null || !group) return null;
    return group.subgroups[targetSubgroupIndex] ?? null;
  }, [group, targetSubgroupIndex]);

  const filteredUsers = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => `${u.name} ${u.role} ${u.joinedText}`.toLowerCase().includes(q));
  }, [users, pickerSearch]);

  const columns = isLandscape ? 4 : 2;
  const gap = isLandscape ? 8 : 12;

  const itemSize = useMemo(() => {
    if (!contentWidth) return 0;
    const availableWidth = contentWidth - gap * (columns - 1);
    return Math.floor(availableWidth / columns);
  }, [contentWidth, columns, gap]);

  const leaderTileWidth = useMemo(() => {
    if (isLandscape) {
      return Math.min(150, Math.floor((contentWidth || width) * 0.2));
    }
    return Math.min(180, Math.floor((contentWidth || width) * 0.48));
  }, [contentWidth, isLandscape, width]);

  const tileWidthStyle = useMemo(
    () => ({
      width: itemSize || Math.floor(width * 0.48 - gap),
    }),
    [itemSize, width, gap]
  );

  const leaderWidthStyle = useMemo(
    () => ({
      width: leaderTileWidth,
    }),
    [leaderTileWidth]
  );

  const openMember = (memberId: string) => {
    router.push({
      pathname: "/admin/member",
      params: {
        memberId,
        groupId,
        groupName: group?.name ?? groupNameParam,
        hideRoleAndMinistries: "true",
      },
    });
  };

  const closeSubgroupMenu = () => {
    setShowSubgroupMenu(false);
    setSubgroupMenuTargetIndex(null);
    setSubgroupMenuAnchor(null);
  };

  const openSubgroupMenu = (subgroupIndex: number) => {
    if (!group) return;
    const subgroup = group.subgroups[subgroupIndex];
    if (!subgroup) return;

    setSubgroupMenuTargetIndex(subgroupIndex);

    const node = subgroupMenuRefs.current[subgroup.id];
    const menuWidth = 190;
    const menuHeight = 96;
    const margin = 12;
    const screen = Dimensions.get("window");

    if (node?.measureInWindow) {
      node.measureInWindow((x, y, width, height) => {
        let left = x + width - menuWidth;
        left = Math.max(margin, Math.min(left, screen.width - menuWidth - margin));

        let top = y + height + 8;
        if (top + menuHeight > screen.height - margin) {
          top = y - menuHeight - 8;
        }
        if (top < margin) top = margin;

        setSubgroupMenuAnchor({ left, top });
        setShowSubgroupMenu(true);
      });
      return;
    }

    setSubgroupMenuAnchor({ left: screen.width - menuWidth - margin, top: 150 });
    setShowSubgroupMenu(true);
  };

  const selectedPickerTitle =
    pickerMode === "newSubgroupLeader"
      ? "Select Subgroup Leader"
      : pickerMode === "newSubgroupMembers"
        ? "Select Subgroup Members"
        : pickerMode === "directMembers"
          ? "Select Members"
          : `Select Members for ${activeSubgroup?.name ?? "Subgroup"}`;

  const pickerBlockedIds = useMemo(() => {
    if (pickerMode === "directMembers") {
      return getBlockedIds(null, true);
    } else if (pickerMode === "existingSubgroupMembers") {
      return getBlockedIds(pickerTargetIndex, false);
    }
    return getBlockedIds(null, false);
  }, [getBlockedIds, pickerMode, pickerTargetIndex]);

  const pickerSelectedUsers = useMemo(
    () => pickerSelectedIds.map((id) => userMap.get(id)).filter(Boolean) as UserOption[],
    [pickerSelectedIds, userMap]
  );

  const selectedLeader = newSubgroupLeaderId ? userMap.get(newSubgroupLeaderId) : null;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F7F8FA]">
        <ActivityIndicator />
      </View>
    );
  }

  if (!group) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F7F8FA] px-6">
        <Ionicons name="people-outline" size={38} color="#9CA3AF" />
        <Text className="mt-3 text-center text-[16px] font-extrabold text-gray-900">Group not found</Text>
        <Text className="mt-1 text-center text-[14px] text-gray-500">
          The selected group may have been deleted or the link is missing an id.
        </Text>
      </View>
    );
  }

  const totalMembers = uniqueMemberIds.length;
  const leaderName = group.leaderName || "Not set";
  const leaderGender = allUsersMap.get(group.leaderId ?? "")?.gender;
  const leaderProfileImageUrl = allUsersMap.get(group.leaderId ?? "")?.profileImageUrl;
  const compactTiles = isLandscape;
  const horizontalSafeSpace = isLandscape ? 28 : 20;
  const innerMaxWidth = isLandscape ? 980 : 980;

  return (
    <>
      <ScrollView className="flex-1 bg-[#F7F8FA]" scrollEnabled={true}>
        <View
          className="flex-1"
          style={{
            paddingHorizontal: horizontalSafeSpace,
            paddingTop: isLandscape ? 18 : 24,
            paddingBottom: 40,
          }}
        >
          <View
            className="flex-1 self-center"
            style={{
              width: "100%",
              maxWidth: innerMaxWidth,
            }}
            onLayout={(event) => {
              setContentWidth(event.nativeEvent.layout.width);
            }}
          >
            <View className="flex-1">
              <View className="mb-4 flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-2xl font-extrabold text-gray-900">{group.name}</Text>
                  {!!group.description && <Text className="mt-1 text-[14px] leading-5 text-gray-600">{group.description}</Text>}
                </View>
                <Pressable onPress={openEditGroupModal} className="h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  <Ionicons name="pencil" size={22} color="#111827" />
                </Pressable>
              </View>

              {showSummaryBoxes ? (
                <View className="flex-row gap-2">
                  <View className="flex-1 items-center rounded-[18px] border border-blue-100 bg-blue-50 p-3">
                    <Text className="text-center text-[12px] font-extrabold text-blue-700">All Members</Text>
                    <Text className="mt-1.5 text-center text-[22px] font-extrabold text-gray-900">{totalMembers}</Text>
                  </View>

                  <View className="flex-1 items-center rounded-[18px] border border-emerald-100 bg-emerald-50 p-3">
                    <Text className="text-center text-[12px] font-extrabold text-emerald-700">Registered</Text>
                    <Text className="mt-1.5 text-center text-[22px] font-extrabold text-gray-900">{registeredCount}</Text>
                  </View>

                  <View className="flex-1 items-center rounded-[18px] border border-amber-100 bg-amber-50 p-3">
                    <Text className="text-center text-[12px] font-extrabold text-amber-700">Unregistered</Text>
                    <Text className="mt-1.5 text-center text-[22px] font-extrabold text-gray-900">{unregisteredCount}</Text>
                  </View>
                </View>
              ) : null}

              <View className="mt-5 rounded-[18px] border border-gray-200 bg-white p-4">
                <View className="items-center">
                  <Text className="text-[13px] font-bold uppercase tracking-[1px] text-gray-500">Head Ministry</Text>
                  <View className="mt-3" style={[leaderWidthStyle, { maxWidth: compactTiles ? 152 : 180 }]}>
                    <SquarePersonTile
                      name={leaderName}
                      gender={leaderGender}
                      registered={Boolean(group?.leaderId && userMap.has(group.leaderId))}
                      showStatus={false}
                      onPress={group.leaderId ? () => openMember(group.leaderId as string) : undefined}
                      compact={compactTiles}
                      profileImageUrl={leaderProfileImageUrl}
                    />
                  </View>
                </View>
              </View>

              {showMembersSection ? (
                <View className="mt-5">
                  <View className="mb-3 flex-row items-center justify-between">
                    <Text className="text-[16px] font-extrabold text-gray-900">Members</Text>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[13px] font-semibold text-gray-500">{directMemberBlocks.length} items</Text>
                    </View>
                  </View>

                  {directMemberBlocks.length > 0 ? (
                    <View
                      className="flex-row flex-wrap justify-start"
                      style={{
                        rowGap: gap,
                        columnGap: gap,
                        justifyContent: "flex-start",
                      }}
                    >
                      {directMemberBlocks.map((member) => (
                        <View key={member.id} style={tileWidthStyle}>
                          <SquarePersonTile
                            name={member.name}
                            gender={member.gender}
                            registered={member.registered}
                            showStatus={showStatusLabels}
                            onPress={() => openMember(member.id)}
                            compact={compactTiles}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View className="rounded-[18px] border border-dashed border-gray-300 bg-white p-6">
                      <Text className="text-center text-gray-500">No members found</Text>
                    </View>
                  )}
                </View>
              ) : null}

              {showGroupsSection ? (
                <View className="mt-5">
                  <View className="mb-3 flex-row items-center justify-between">
                    <Text className="text-[16px] font-extrabold text-gray-900">Groups</Text>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[13px] font-semibold text-gray-500">{subgroupBlocks.length} items</Text>
                      <Pressable onPress={openCreateSubgroupModal} className="h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                        <Ionicons name="add" size={22} color="#111827" />
                      </Pressable>
                    </View>
                  </View>

                  {subgroupBlocks.length === 0 ? (
                    <View className="rounded-[18px] border border-dashed border-gray-300 bg-white p-6">
                      <Text className="text-center text-gray-500">No groups found</Text>
                    </View>
                  ) : (
                    <View className="gap-3">
                      {subgroupBlocks.map((subgroup, subgroupIndex) => {
                        return (
                          <View key={subgroup.id} className="rounded-[18px] border border-gray-200 bg-white p-4" style={{ overflow: "visible" }}>
                            <View className="mb-3 flex-row items-center justify-between gap-2" style={{ zIndex: 100 }}>
                              <Text className="flex-1 text-[14px] font-bold text-gray-900">{subgroup.name || `Group ${subgroupIndex + 1}`}</Text>
                              <Pressable onPress={() => setSubgroupMenuTargetIndex(subgroupMenuTargetIndex === subgroupIndex ? null : subgroupIndex)} className="h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                                <Ionicons name="ellipsis-vertical" size={18} color="#111827" />
                              </Pressable>
                              {subgroupMenuTargetIndex === subgroupIndex && (
                                <View className="absolute right-0 top-10 z-50 rounded-lg border border-gray-200 bg-white shadow-lg" style={{ pointerEvents: "auto" }}>
                                  <Pressable onPress={() => { setSubgroupMenuTargetIndex(null); setTargetSubgroupIndex(subgroupIndex); openAddMembersModal(subgroupIndex); }} style={{ pointerEvents: "auto" }} className="flex-row items-center gap-2 border-b border-gray-200 px-4 py-3">
                                    <Ionicons name="create" size={16} color="#111827" />
                                    <Text className="text-[13px] font-semibold text-gray-900">Edit</Text>
                                  </Pressable>
                                  <Pressable onPress={() => { setSubgroupMenuTargetIndex(null); setDeleteConfirmIndex(subgroupIndex); setShowDeleteConfirmModal(true); }} style={{ pointerEvents: "auto" }} className="flex-row items-center gap-2 px-4 py-3">
                                    <Ionicons name="trash" size={16} color="#DC2626" />
                                    <Text className="text-[13px] font-semibold text-red-600">Delete</Text>
                                  </Pressable>
                                </View>
                              )}
                            </View>
                            <View className="items-center">
                              <Text className="text-[13px] font-bold uppercase tracking-[1px] text-gray-500">Leader</Text>
                              <View className="mt-3" style={[leaderWidthStyle, { maxWidth: compactTiles ? 152 : 180 }]}>
                                <SquarePersonTile
                                  name={subgroup.leaderName || "Not set"}
                                  registered={Boolean(subgroup.leaderId && userMap.has(subgroup.leaderId))}
                                  showStatus={showStatusLabels}
                                  onPress={subgroup.leaderId ? () => openMember(subgroup.leaderId as string) : undefined}
                                  compact={compactTiles}
                                />
                              </View>
                            </View>

                            <View className="my-4 h-px bg-gray-200" />

                            <View
                              className="flex-row flex-wrap justify-start"
                              style={{
                                rowGap: gap,
                                columnGap: gap,
                                justifyContent: "flex-start",
                              }}
                            >
                              {subgroup.members.length === 0 ? (
                                <Text className="text-gray-500">No members in this subgroup</Text>
                              ) : (
                                subgroup.members.map((member) => {
                                  return (
                                    <View key={`${subgroup.id}-${member.id}`} style={tileWidthStyle}>
                                      <SquarePersonTile
                                        name={member.name}
                                        gender={member.gender}
                                        registered={member.registered}
                                        showStatus={showStatusLabels}
                                        onPress={() => openMember(member.id)}
                                        compact={compactTiles}
                                      />
                                    </View>
                                  );
                                })
                              )}
                            </View>

                            {subgroupIndex < subgroupBlocks.length - 1 ? <View className="mt-4 h-px bg-gray-200" /> : null}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showSubgroupMenu} transparent animationType="fade" onRequestClose={closeSubgroupMenu}>
        <Pressable onPress={closeSubgroupMenu} className="flex-1 bg-black/10" />
        {subgroupMenuAnchor ? (
          <View
            className="absolute z-[9999] w-[190px] overflow-hidden rounded-[18px] border border-gray-200 bg-white shadow-xl"
            style={{ left: subgroupMenuAnchor.left, top: subgroupMenuAnchor.top }}
            onStartShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
          >
            <Pressable
              onPress={() => {
                const index = subgroupMenuTargetIndex;
                closeSubgroupMenu();
                if (index !== null) openAddMembersModal(index);
              }}
              className="flex-row items-center gap-2.5 px-4 py-3"
            >
              <Ionicons name="create-outline" size={18} color="#111827" />
              <Text className="text-[14px] font-semibold text-gray-900">Edit Group</Text>
            </Pressable>

            <View className="h-px bg-gray-100" />

            <Pressable
              onPress={() => {
                const index = subgroupMenuTargetIndex;
                closeSubgroupMenu();
                if (index !== null) {
                  deleteSelectedSubgroup(index);
                }
              }}
              className="flex-row items-center gap-2.5 px-4 py-3"
            >
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
              <Text className="text-[14px] font-semibold text-red-600">Delete Group</Text>
            </Pressable>
          </View>
        ) : null}
      </Modal>

      <DeleteConfirmModal
        visible={showDeleteConfirmModal}
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={confirmDelete}
        subgroupName={deleteConfirmIndex !== null ? group?.subgroups[deleteConfirmIndex]?.name : undefined}
        savingAction={savingAction}
      />

      <NewSubgroupModal
        visible={showNewSubgroupModal}
        onClose={closeNewSubgroupModal}
        onCreate={createSubgroup}
        group={group}
        newSubgroupLeaderId={newSubgroupLeaderId}
        newSubgroupMemberIds={newSubgroupMemberIds}
        userMap={userMap}
        onOpenUserPicker={openUserPicker}
        selectedLeader={selectedLeader}
        savingAction={savingAction}
        indexToLetters={indexToLetters}
      />

      <AddMembersModal
        visible={showAddMembersModal}
        onClose={closeAddMembersModal}
        onSave={saveMembersToSubgroup}
        activeSubgroup={activeSubgroup}
        memberSelectionIds={memberSelectionIds}
        userMap={userMap}
        onOpenUserPicker={openUserPicker}
        savingAction={savingAction}
        editSubgroupLeaderId={editSubgroupLeaderId}
        onEditLeaderClick={openEditSubgroupLeaderPicker}
      />

      <EditGroupModal
        visible={showEditGroupModal}
        onClose={closeEditGroupModal}
        onSave={saveEditGroup}
        group={group}
        editName={editName}
        onEditNameChange={setEditName}
        editDescription={editDescription}
        onEditDescriptionChange={setEditDescription}
        editLeaderId={editLeaderId}
        userMap={userMap}
        onOpenUserPicker={openEditLeaderPicker}
        selectedEditLeader={editLeaderId ? userMap.get(editLeaderId) : null}
        savingAction={savingAction}
      />

      <UserPickerModal
        visible={showUserPickerModal}
        onClose={closeUserPicker}
        onConfirm={confirmUserPicker}
        pickerMode={pickerMode}
        pickerSearch={pickerSearch}
        onPickerSearchChange={setPickerSearch}
        filteredUsers={filteredUsers}
        pickerSelectedIds={pickerSelectedIds}
        pickerBlockedIds={pickerBlockedIds}
        onToggleUser={togglePickerUser}
        selectedPickerTitle={selectedPickerTitle}
        pickerSelectedUsers={pickerSelectedUsers}
      />
    </>
  );
}