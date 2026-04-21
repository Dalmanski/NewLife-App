import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { TextInput } from "react-native-paper";
import { db } from "../../lib/firebaseConfig";

const PAGE_PADDING = 20;
const GAP = 12;
const MAX_LANDSCAPE_COLUMNS = 4;

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

export default function Group({ userId, userRole, memberName, isLandscape }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [containerWidth, setContainerWidth] = useState(0);

  const columns = isLandscape ? MAX_LANDSCAPE_COLUMNS : 2;

  const itemSize = useMemo(() => {
    if (!containerWidth) return 0;
    const availableWidth =
      containerWidth - PAGE_PADDING * 2 - GAP * (columns - 1);
    return Math.floor(availableWidth / columns);
  }, [containerWidth, columns]);

  const iconSize = useMemo(() => {
    if (!itemSize) return 36;
    return Math.max(28, Math.min(36, Math.floor(itemSize * 0.28)));
  }, [itemSize]);

  const iconBoxSize = useMemo(() => {
    if (!itemSize) return 72;
    return Math.max(52, Math.min(72, Math.floor(itemSize * 0.44)));
  }, [itemSize]);

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

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;

    return groups.filter((group) => {
      const nameMatch = group.name.toLowerCase().includes(q);
      const descriptionMatch = group.description.toLowerCase().includes(q);
      const leaderMatch = group.leaderName.toLowerCase().includes(q);
      return nameMatch || descriptionMatch || leaderMatch;
    });
  }, [groups, searchQuery]);

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

  const onContainerLayout = (event) => {
    const width = event.nativeEvent.layout.width;
    setContainerWidth(width);
  };

  const renderItem = ({ item, index }) => {
    const isLastInRow = (index + 1) % columns === 0;

    return (
      <View
        style={[
          styles.cardWrapper,
          {
            width: itemSize,
            height: itemSize,
            marginRight: isLastInRow ? 0 : GAP,
            marginBottom: GAP,
          },
        ]}
      >
        <Pressable onPress={() => openGroup(item)} style={styles.card}>
          <View style={styles.cardInner}>
            <View
              style={[
                styles.iconBox,
                {
                  width: iconBoxSize,
                  height: iconBoxSize,
                  borderRadius: Math.floor(iconBoxSize * 0.22),
                },
              ]}
            >
              <Ionicons name={getIconName(item.kind)} size={iconSize} color="white" />
            </View>
            <Text numberOfLines={2} style={styles.cardTitle}>
              {item.name}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container} onLayout={onContainerLayout}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
          key={`${columns}-${itemSize}`}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={columns}
          ListHeaderComponent={
            <View style={styles.headerWrap}>
              <TextInput
                mode="outlined"
                label="Search group"
                value={searchQuery}
                onChangeText={setSearchQuery}
                left={<TextInput.Icon icon="magnify" />}
                right={
                  searchQuery ? (
                    <TextInput.Icon
                      icon="close-circle"
                      onPress={() => setSearchQuery("")}
                    />
                  ) : null
                }
                theme={{
                  roundness: 16,
                }}
                outlineStyle={{
                  borderRadius: 16,
                }}
                contentStyle={{
                  paddingHorizontal: 4,
                }}
                style={{
                  backgroundColor: "white",
                }}
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="folder-open-outline" size={34} color="#9CA3AF" />
              <Text style={styles.emptyText}>No groups found</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  listContent: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: PAGE_PADDING,
    paddingBottom: 100,
  },
  headerWrap: {
    marginBottom: 16,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  columnWrapper: {
    justifyContent: "flex-start",
  },
  cardWrapper: {
    overflow: "hidden",
  },
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "white",
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },
  cardInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
    padding: 12,
  },
  iconBox: {
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  cardTitle: {
    paddingHorizontal: 8,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
    color: "#111827",
  },
  emptyWrap: {
    marginTop: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
    backgroundColor: "white",
    padding: 24,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },
});