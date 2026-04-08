import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { db } from "../../lib/firebaseConfig";

const normalizeIds = (ids) => Array.from(new Set(ids.filter(Boolean)));

const getErrorMessage = (error) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

const getIconName = (kind) => (kind === "ministry" ? "business" : "people");

const parseBooleanLike = (value, fallback = true) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "active", "enabled"].includes(normalized)) return true;
    if (["false", "0", "no", "inactive", "disabled"].includes(normalized)) return false;
  }

  return fallback;
};

export default function Group({ userId, userRole, memberName }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ministrySnap, coreGroupSnap] = await Promise.all([
        getDocs(collection(db, "ministries")),
        getDocs(collection(db, "coreGroups")),
      ]);

      const parseGroups = (snap, kind) => {
        return snap.docs
          .map((d) => {
            const data = d.data();
            const rawActive =
              data?.isActive ?? data?.active ?? data?.status ?? data?.state;

            const subgroups = Array.isArray(data?.subgroups)
              ? data.subgroups.map((subgroup, index) => ({
                  id: String(subgroup?.id ?? `${d.id}-${index}`),
                  name: String(subgroup?.name ?? ""),
                  memberIds: normalizeIds(
                    Array.isArray(subgroup?.memberIds)
                      ? subgroup.memberIds.map((x) => String(x))
                      : []
                  ),
                }))
              : [];

            return {
              id: d.id,
              kind,
              name: String(data?.name ?? "").trim(),
              description: String(data?.description ?? "").trim(),
              leaderId: String(data?.leaderId ?? ""),
              leaderName: String(data?.leaderName ?? ""),
              leaderRole: String(data?.leaderRole ?? ""),
              createdAt: data?.createdAt,
              isActive: parseBooleanLike(rawActive, true),
              subgroups,
            };
          })
          .filter((x) => x.name)
          .sort((a, b) => a.name.localeCompare(b.name));
      };

      const ministryData = parseGroups(ministrySnap, "ministry");
      const coreGroupData = parseGroups(coreGroupSnap, "coreGroup");

      setGroups(
        [...ministryData, ...coreGroupData].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
    } catch (error) {
      Alert.alert("Error", `Failed to load groups\n${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openGroup = (group) => {
    const baseParams = {
      groupId: group.id,
      groupKind: group.kind,
      groupName: group.name,
      id: String(userId ?? ""),
      userId: String(userId ?? ""),
      userRole: String(userRole ?? ""),
      role: String(userRole ?? ""),
      memberName: String(memberName ?? ""),
    };

    router.push({
      pathname: group.isActive ? "/task-board" : "/admin/members",
      params: baseParams,
    });
  };

  return (
    <View className="flex-1 bg-[#F7F8FA]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-5 pb-[100px]"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View className="py-10">
            <ActivityIndicator />
          </View>
        ) : groups.length === 0 ? (
          <View className="mt-8 items-center justify-center rounded-[18px] border border-dashed border-gray-300 bg-white p-6">
            <Ionicons name="folder-open-outline" size={34} color="#9CA3AF" />
            <Text className="mt-3 text-[15px] font-semibold text-gray-500">
              No groups found
            </Text>
          </View>
        ) : (
          <View className="mt-4 flex-row flex-wrap justify-between gap-y-3">
            {groups.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => openGroup(group)}
                className="aspect-square w-[48.5%] rounded-[18px] border border-gray-200 bg-white p-3 shadow-sm"
              >
                <View className="flex-1 items-center justify-center rounded-[14px] bg-gray-50">
                  <View className="mb-3 h-[72px] w-[72px] items-center justify-center rounded-2xl bg-gray-900">
                    <Ionicons
                      name={getIconName(group.kind)}
                      size={36}
                      color="white"
                    />
                  </View>

                  <Text
                    numberOfLines={2}
                    className="px-2 text-center text-[16px] font-extrabold leading-5 text-gray-900"
                  >
                    {group.name}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}