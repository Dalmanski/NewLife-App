import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { db } from "../../lib/firebaseConfig";

type GroupKind = "ministry" | "coreGroup";

type MemberData = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  fullName?: string;
  role?: string;
  email?: string;
  contact?: string;
  phone?: string;
  username?: string;
  address?: string;
  gender?: string;
  civilStatus?: string;
  status?: string;
  birthDate?: string;
  createdAt?: Timestamp | string | Date;
  updatedAt?: Timestamp | string | Date;
  joinedAt?: Timestamp | string | Date;
  startedAt?: Timestamp | string | Date;
  ministry?: any;
  coreGroup?: any;
  subGroup?: any;
  [key: string]: any;
};

const getMemberName = (raw: any) => {
  return String(
    raw?.fullName ??
      raw?.name ??
      raw?.memberName ??
      raw?.username ??
      raw?.firstName ??
      raw?.email ??
      "Unnamed"
  );
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

const toDateValue = (value: any) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    try {
      return value.toDate() as Date;
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatDateValue = (value: any) => {
  const date = toDateValue(value);
  if (!date) return "—";
  try {
    return date.toLocaleString();
  } catch {
    return "—";
  }
};

const timeAgo = (value: any) => {
  const date = toDateValue(value);
  if (!date) return "—";

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;

  const diffMon = Math.floor(diffDay / 30);
  if (diffMon < 12) return `${diffMon}mo ago`;

  const diffYr = Math.floor(diffMon / 12);
  return `${diffYr}y ago`;
};

const formatValue = (value: any) => {
  if (value === null || value === undefined || value === "") return "—";

  if (Array.isArray(value)) {
    const items = value
      .map((item) => {
        if (item === null || item === undefined || item === "") return "";
        if (typeof item === "object") {
          return String(
            item.groupName ??
              item.subgroupName ??
              item.name ??
              item.label ??
              item.title ??
              ""
          );
        }
        return String(item);
      })
      .filter(Boolean);

    return items.length ? items.join(", ") : "—";
  }

  if (typeof value === "object") {
    return String(
      value.groupName ??
        value.subgroupName ??
        value.name ??
        value.label ??
        value.title ??
        "—"
    );
  }

  return String(value);
};

const getGroupDisplay = (value: any) => {
  if (!value) return "—";
  if (Array.isArray(value)) {
    return (
      value
        .map((item) => {
          if (typeof item === "object" && item) {
            return item.groupName ?? item.subgroupName ?? item.name ?? item.title ?? "";
          }
          return String(item ?? "");
        })
        .filter(Boolean)
        .join(", ") || "—"
    );
  }

  if (typeof value === "object") {
    return value.groupName ?? value.subgroupName ?? value.name ?? value.title ?? "—";
  }

  return String(value);
};

function InfoRow({ label, value }: { label: string; value: any }) {
  const finalValue = formatValue(value);
  if (!finalValue || finalValue === "—") return null;

  return (
    <View className="flex-row items-start justify-between gap-4 border-b border-gray-100 py-3 last:border-b-0">
      <Text className="w-[42%] text-[12px] font-bold uppercase tracking-[1px] text-gray-500">
        {label}
      </Text>
      <Text className="flex-1 text-right text-[14px] font-semibold leading-5 text-gray-900">
        {finalValue}
      </Text>
    </View>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-4 overflow-hidden rounded-[20px] border border-gray-200 bg-white">
      <View className="border-b border-gray-100 px-4 py-3">
        <Text className="text-[14px] font-extrabold text-gray-900">{title}</Text>
      </View>
      <View className="px-4">{children}</View>
    </View>
  );
}

export default function Member(props?: { memberId?: string; groupId?: string; groupKind?: string; groupName?: string }) {
  const params = useLocalSearchParams<{
    memberId?: string;
    groupId?: string;
    groupKind?: string;
    groupName?: string;
  }>();

  const memberId = String(params.memberId ?? props?.memberId ?? "");
  const groupId = String(params.groupId ?? props?.groupId ?? "");
  const groupKind = String(params.groupKind ?? props?.groupKind ?? "") as GroupKind;
  const groupName = String(params.groupName ?? props?.groupName ?? "");

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<MemberData | null>(null);

  const loadData = useCallback(async () => {
    if (!memberId) {
      setMember(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", memberId));
      if (!snap.exists()) {
        setMember(null);
        setLoading(false);
        return;
      }

      const raw = snap.data() as any;

      setMember({
        ...raw,
        id: snap.id,
        firstName: String(raw?.firstName ?? ""),
        lastName: String(raw?.lastName ?? ""),
        name: String(raw?.name ?? getMemberName(raw)),
        fullName: String(raw?.fullName ?? ""),
        role: String(raw?.role ?? ""),
        email: String(raw?.email ?? ""),
        contact: String(raw?.contact ?? raw?.phone ?? raw?.contactNumber ?? ""),
        phone: String(raw?.phone ?? raw?.contactNumber ?? raw?.contact ?? ""),
        username: String(raw?.username ?? ""),
        address: String(raw?.address ?? raw?.location ?? ""),
        gender: String(raw?.gender ?? ""),
        civilStatus: String(raw?.civilStatus ?? ""),
        status: String(raw?.status ?? ""),
        birthDate: String(raw?.birthDate ?? raw?.birthday ?? ""),
        createdAt: raw?.createdAt,
        updatedAt: raw?.updatedAt,
        joinedAt: raw?.joinedAt,
        startedAt: raw?.startedAt,
        ministry: raw?.subGroup?.ministry ?? raw?.ministry ?? null,
        coreGroup: raw?.subGroup?.coreGroup ?? raw?.coreGroup ?? null,
        subGroup: raw?.subGroup ?? null,
      });
    } catch (error) {
      Alert.alert("Error", `Failed to load member\n${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const startedSource = member?.startedAt ?? member?.joinedAt ?? member?.createdAt ?? null;

  const statusLabel = useMemo(() => {
    const raw = String(member?.status ?? "").toLowerCase().trim();
    if (raw.includes("pend")) return "Pending";
    if (raw.includes("unreg")) return "Unregistered";
    if (raw.includes("reg")) return "Registered";
    return member ? "Registered" : "Unregistered";
  }, [member]);

  const statusStyle = useMemo(() => {
    const raw = String(member?.status ?? "").toLowerCase().trim();
    if (raw.includes("pend")) {
      return {
        container: "bg-amber-50 border-amber-100",
        text: "text-amber-700",
        dot: "bg-amber-500",
      };
    }
    if (raw.includes("unreg")) {
      return {
        container: "bg-gray-100 border-gray-200",
        text: "text-gray-700",
        dot: "bg-gray-400",
      };
    }
    return {
      container: "bg-emerald-50 border-emerald-100",
      text: "text-emerald-700",
      dot: "bg-emerald-500",
    };
  }, [member]);

  const ministryDisplay = useMemo(() => {
    return getGroupDisplay(member?.subGroup?.ministry ?? member?.ministry);
  }, [member]);

  const coreGroupDisplay = useMemo(() => {
    return getGroupDisplay(member?.subGroup?.coreGroup ?? member?.coreGroup);
  }, [member]);

  const identityRows = useMemo(() => {
    if (!member) return [];
    return [
      { label: "First Name", value: member.firstName },
      { label: "Last Name", value: member.lastName },
      { label: "Name", value: member.name },
      { label: "Username", value: member.username },
      { label: "Role", value: member.role },
      { label: "Civil Status", value: member.civilStatus },
      { label: "Gender", value: member.gender },
      { label: "Birth Date", value: member.birthDate },
    ];
  }, [member]);

  const groupRows = useMemo(() => {
    if (!member) return [];
    return [
      { label: "Ministry", value: ministryDisplay },
      { label: "Core Group", value: coreGroupDisplay },
    ];
  }, [member, ministryDisplay, coreGroupDisplay]);

  const systemRows = useMemo(() => {
    if (!member) return [];
    return [
      { label: "Started At", value: formatDateValue(startedSource) },
      { label: "Created At", value: formatDateValue(member.createdAt) },
      { label: "Updated At", value: formatDateValue(member.updatedAt) },
      { label: "Member ID", value: member.id },
    ];
  }, [member, startedSource]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F7F8FA]">
        <ActivityIndicator />
      </View>
    );
  }

  if (!member) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F7F8FA] px-6">
        <Ionicons name="person-circle-outline" size={42} color="#9CA3AF" />
        <Text className="mt-3 text-center text-[16px] font-extrabold text-gray-900">
          Member not found
        </Text>
        <Text className="mt-1 text-center text-[14px] text-gray-500">
          The selected member may have been removed or the link is incomplete.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F7F8FA]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-5 pb-[110px]"
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm">
          <View className="flex-row items-start gap-4">
            <View className="h-[92px] w-[92px] items-center justify-center rounded-[28px] bg-gray-900">
              <Ionicons name="person" size={44} color="white" />
            </View>

            <View className="flex-1">
              <Text className="text-[12px] font-bold uppercase tracking-[1px] text-gray-500">
                PROFILE
              </Text>
              <Text className="mt-1 text-[22px] font-extrabold leading-7 text-gray-900">
                {member.fullName || member.name}
              </Text>

              <View className="mt-1 flex-row items-center gap-2">
                {!!member.role && (
                  <Text className="text-[14px] font-semibold text-gray-500">
                    {member.role}
                  </Text>
                )}

                <View className={`rounded-full border px-3 py-2 ${statusStyle.container}`}>
                  <View className="flex-row items-center gap-2">
                    <View className={`h-2.5 w-2.5 rounded-full ${statusStyle.dot}`} />
                    <Text className={`text-[12px] font-bold ${statusStyle.text}`}>
                      {statusLabel}
                    </Text>
                    <Text className={`mt-0.5 text-[11px] font-semibold ${statusStyle.text}`}>
                      {timeAgo(startedSource)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        <SectionCard title="Group Assignment">
          {groupRows.map((row) => (
            <InfoRow key={row.label} label={row.label} value={row.value} />
          ))}
        </SectionCard>

        <SectionCard title="Basic Information">
          {identityRows.map((row) => (
            <InfoRow key={row.label} label={row.label} value={row.value} />
          ))}
        </SectionCard>

        <SectionCard title="System Information">
          {systemRows.map((row) => (
            <InfoRow key={row.label} label={row.label} value={row.value} />
          ))}
        </SectionCard>
      </ScrollView>
    </View>
  );
}