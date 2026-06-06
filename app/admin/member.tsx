import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import { collection, doc, getDocs, getDoc, Timestamp } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { db } from "../../lib/firebaseConfig";

type TagItem = {
  name: string;
  color: string;
};

type SocialLinkItem = {
  url: string;
  platform?: string;
  host?: string;
  color?: string;
  icon?: string;
};

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
  tags?: TagItem[];
  subGroup?: any;
  socialLinks?: SocialLinkItem[];
  [key: string]: any;
};

const MINISTRY_TAG_COLOR_MAP: Record<string, string> = {
  gray: "#6B7280",
  blue: "#2563EB",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  purple: "#8B5CF6",
  pink: "#EC4899",
  teal: "#14B8A6",
};

const normalizeMinistryColorTag = (value: unknown) => {
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

const normalizeTagList = (value: unknown): TagItem[] => {
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

const normalizeSocialLinks = (value: unknown): SocialLinkItem[] => {
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

    result.push({
      url,
      ...detectSocialPlatform(url),
    });
  });

  return result;
};

const detectSocialPlatform = (value: string) => {
  const text = String(value ?? "").trim();
  if (!text) {
    return {
      platform: "Website",
      host: "",
      color: "#64748B",
      icon: "link",
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
      return { platform: "Facebook", host, color: "#1877F2", icon: "logo-facebook" };
    }

    if (host.includes("instagram.com")) {
      return { platform: "Instagram", host, color: "#E1306C", icon: "logo-instagram" };
    }

    if (host.includes("tiktok.com")) {
      return { platform: "TikTok", host, color: "#111827", icon: "logo-tiktok" };
    }

    if (host === "x.com" || host.includes("twitter.com")) {
      return { platform: "X", host, color: "#111827", icon: "logo-twitter" };
    }

    if (host.includes("youtube.com") || host === "youtu.be") {
      return { platform: "YouTube", host, color: "#FF0000", icon: "logo-youtube" };
    }

    if (host.includes("linkedin.com")) {
      return { platform: "LinkedIn", host, color: "#0A66C2", icon: "logo-linkedin" };
    }

    if (host.includes("threads.net")) {
      return { platform: "Threads", host, color: "#111827", icon: "link" };
    }

    if (host.includes("github.com")) {
      return { platform: "GitHub", host, color: "#111827", icon: "logo-github" };
    }

    if (host.includes("reddit.com")) {
      return { platform: "Reddit", host, color: "#FF4500", icon: "logo-reddit" };
    }

    if (host.includes("t.me") || host.includes("telegram.me")) {
      return { platform: "Telegram", host, color: "#229ED9", icon: "paper-plane" };
    }

    if (host.includes("wa.me") || host.includes("whatsapp.com")) {
      return { platform: "WhatsApp", host, color: "#25D366", icon: "logo-whatsapp" };
    }

    if (host.includes("discord.com")) {
      return { platform: "Discord", host, color: "#5865F2", icon: "logo-discord" };
    }

    return {
      platform: host ? "Website" : "Unknown",
      host,
      color: "#64748B",
      icon: "link",
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

const openExternalUrl = async (rawUrl: string) => {
  const text = String(rawUrl ?? "").trim();
  if (!text) return;

  let url = text;
  if (!/^https?:\/\//i.test(url) && !/^sip:/i.test(url) && !/^callto:/i.test(url)) {
    url = `https://${url}`;
  }

  if (Platform.OS === "web") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    Alert.alert("Error", "Cannot open this link");
  }
};

const openPhoneByPlatform = async (value: string) => {
  const raw = String(value ?? "").trim();
  if (!raw) return;

  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return;

  if (Platform.OS === "web") {
    const url = `https://teams.microsoft.com/l/call/0/0?users=4:${digits}`;
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  const url = `tel:${digits}`;
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    Alert.alert("Error", "Cannot open dialer");
  }
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

function SocialButton({ item }: { item: SocialLinkItem }) {
  const iconName = String(item.icon ?? "link") as any;
  const color = item.color || "#64748B";

  return (
    <Pressable
      onPress={() => openExternalUrl(item.url)}
      className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white"
      style={({ pressed }) =>
        pressed ? { opacity: 0.85, transform: [{ scale: 0.96 }] } : undefined
      }
    >
      <Ionicons name={iconName} size={18} color={color} />
    </Pressable>
  );
}

export default function Member(props?: {
  memberId?: string;
  groupId?: string;
  ministry?: string;
  groupName?: string;
  viewerRole?: string;
  accountRole?: string;
}) {
  const params = useLocalSearchParams<{
    memberId?: string;
    groupId?: string;
    ministry?: string;
    groupName?: string;
    hideRoleAndMinistries?: string;
    viewerRole?: string;
    accountRole?: string;
    role?: string;
  }>();

  const memberId = String(params.memberId ?? props?.memberId ?? "");
  const ministryParam = String(params.ministry ?? props?.ministry ?? "");
  const hideRoleAndMinistries = String(params.hideRoleAndMinistries ?? "false") === "true";

  const [viewerRole, setViewerRole] = useState("");

  useEffect(() => {
    const loadViewerRole = async () => {
      try {
        const paramsRole = String(
          params.viewerRole ?? params.accountRole ?? params.role ?? props?.viewerRole ?? props?.accountRole ?? ""
        )
          .trim()
          .toLowerCase();

        if (paramsRole) {
          setViewerRole(paramsRole);
          return;
        }

        const storedRole = await AsyncStorage.getItem("userRole");
        if (storedRole) {
          setViewerRole(String(storedRole).trim().toLowerCase());
        }
      } catch (error) {
        console.error("Failed to load viewer role:", error);
      }
    };

    loadViewerRole();
  }, [params, props?.viewerRole, props?.accountRole]);

  const canViewStatus = viewerRole === "admin";

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isWeb = Platform.OS === "web";
  const isAndroid = Platform.OS === "android";
  const useDesktopHeaderLayout = isWeb && isLandscape;
  const useMobileHeaderLayout = !useDesktopHeaderLayout;

  const contentMaxWidth = useDesktopHeaderLayout ? 980 : undefined;
  const outerHorizontalPadding = useDesktopHeaderLayout ? 24 : 0;
  const innerHorizontalPadding = useDesktopHeaderLayout ? 24 : 16;

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
      const ministryValue = raw?.subGroup?.ministry ?? raw?.ministry ?? null;
      const ministryNames = Array.isArray(ministryValue)
        ? ministryValue.map((x) => String(x).trim()).filter(Boolean)
        : ministryValue
          ? [String(ministryValue).trim()]
          : [];

      const ministryColorMap = new Map<string, string>();
      if (ministryNames.length > 0) {
        const ministrySnap = await getDocs(collection(db, "ministries"));
        ministrySnap.docs.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const ministryName = String(data?.name ?? "").trim();
          const colorTag = data?.colorTag ?? data?.tagColor ?? "#6B7280";
          if (ministryName) {
            ministryColorMap.set(ministryName.toLowerCase(), colorTag);
          }
        });
      }

      const tagsFromMinistry = ministryNames.map((name) => ({
        name,
        color: normalizeMinistryColorTag(
          ministryColorMap.get(name.toLowerCase()) ?? "#6B7280"
        ),
      }));
      const existingTags = normalizeTagList(raw?.tags);

      const seen = new Set(existingTags.map((tag) => tag.name.trim().toLowerCase()));
      const mergedTags = [
        ...tagsFromMinistry.filter((tag) => {
          const key = tag.name.trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
        ...existingTags,
      ];

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
        ministry: ministryValue,
        tags: mergedTags,
        subGroup: raw?.subGroup ?? null,
        socialLinks: normalizeSocialLinks(raw?.socialLinks ?? raw?.socials ?? raw?.links ?? []),
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
    return getGroupDisplay(member?.subGroup?.ministry ?? member?.ministry ?? ministryParam);
  }, [member, ministryParam]);

  const displayTags = member?.tags ?? [];
  const displaySocialLinks = member?.socialLinks ?? [];
  const contactValue = String(member?.contact ?? member?.phone ?? "").trim();

  const identityRows = useMemo(() => {
    if (!member) return [];
    return [
      { label: "First Name", value: member.firstName },
      { label: "Last Name", value: member.lastName },
      { label: "Name", value: member.name },
      { label: "Username", value: member.username },
      { label: "Civil Status", value: member.civilStatus },
      { label: "Gender", value: member.gender },
      { label: "Birth Date", value: member.birthDate },
    ];
  }, [member]);

  const groupRows = useMemo(() => {
    if (!member) return [];
    if (hideRoleAndMinistries) return [];
    return [{ label: "Ministry", value: ministryDisplay }];
  }, [member, ministryDisplay, hideRoleAndMinistries]);

  const systemRows = useMemo(() => {
    if (!member) return [];
    return [
      { label: "Started At", value: formatDateValue(startedSource) },
      { label: "Created At", value: formatDateValue(member.createdAt) },
      { label: "Updated At", value: formatDateValue(member.updatedAt) },
      { label: "Member ID", value: member.id },
    ];
  }, [member, startedSource]);

  const renderDesktopHeader = () => (
    <View className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm">
      <View className="flex-row items-start gap-4">
        <View className="h-[92px] w-[92px] items-center justify-center rounded-[28px] bg-gray-900">
          <Ionicons name="person" size={44} color="white" />
        </View>

        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1">
              <Text className="text-[22px] font-extrabold leading-7 text-gray-900">
                {member?.fullName || member?.name}
              </Text>

              {displayTags.length ? (
                <View className="mt-2 flex-row flex-wrap gap-2">
                  {displayTags.map((tag, index) => (
                    <View
                      key={`${tag.name}-${index}`}
                      className="flex-row items-center gap-2 rounded-full px-3 py-1.5"
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
                    </View>
                  ))}
                </View>
              ) : null}

              {canViewStatus ? (
                <View className={`mt-2 self-start rounded-full border px-3 py-2 ${statusStyle.container}`}>
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
              ) : null}
            </View>

            <View className="items-end gap-2">
              <View className="flex-row flex-wrap justify-end gap-2">
                {displaySocialLinks.length
                  ? displaySocialLinks.map((item, index) => (
                      <SocialButton key={`${item.url}-${index}`} item={item} />
                    ))
                  : null}
              </View>

              {contactValue ? (
                <Pressable
                  onPress={() => openPhoneByPlatform(contactValue)}
                  className="flex-row items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2"
                  style={({ pressed }) =>
                    pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
                  }
                >
                  <Ionicons name="call" size={16} color="#2563EB" />
                  <Text className="text-[13px] font-bold text-gray-900">{contactValue}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const renderMobileHeader = () => (
    <View className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm">
      <View className="items-center">
        <View className="h-[92px] w-[92px] items-center justify-center rounded-[28px] bg-gray-900">
          <Ionicons name="person" size={44} color="white" />
        </View>

        <Text className="mt-4 text-center text-[22px] font-extrabold leading-7 text-gray-900">
          {member?.fullName || member?.name}
        </Text>
      </View>

      <View className="mt-4 flex-row gap-3">
        <View className="flex-1 rounded-[18px] border border-gray-200 bg-gray-50 px-3 py-3">
          <Text className="text-[11px] font-extrabold uppercase tracking-[1px] text-gray-500">
            Tags / Status
          </Text>

          {displayTags.length ? (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {displayTags.map((tag, index) => (
                <View
                  key={`${tag.name}-${index}`}
                  className="flex-row items-center gap-2 rounded-full px-3 py-1.5"
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
                </View>
              ))}
            </View>
          ) : (
            <Text className="mt-3 text-[13px] font-semibold text-gray-400">—</Text>
          )}

          {canViewStatus ? (
            <View className={`mt-3 self-start rounded-full border px-3 py-2 ${statusStyle.container}`}>
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
          ) : null}
        </View>

        <View className="flex-1 rounded-[18px] border border-gray-200 bg-gray-50 px-3 py-3">
          <Text className="text-[11px] font-extrabold uppercase tracking-[1px] text-gray-500">
            Links / Phone
          </Text>

          <View className="mt-3 flex-row flex-wrap gap-2">
            {displaySocialLinks.length ? (
              displaySocialLinks.map((item, index) => (
                <SocialButton key={`${item.url}-${index}`} item={item} />
              ))
            ) : (
              <Text className="text-[13px] font-semibold text-gray-400">—</Text>
            )}
          </View>

          {contactValue ? (
            <Pressable
              onPress={() => openPhoneByPlatform(contactValue)}
              className="mt-3 flex-row items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-3"
              style={({ pressed }) =>
                pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : undefined
              }
            >
              <Ionicons name="call" size={16} color="#2563EB" />
              <Text className="text-[13px] font-bold text-gray-900">{contactValue}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );

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
        contentContainerStyle={{
          paddingHorizontal: outerHorizontalPadding,
          paddingTop: 20,
          paddingBottom: 110,
          alignItems: "center",
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: "100%",
            maxWidth: contentMaxWidth,
            paddingHorizontal: innerHorizontalPadding,
          }}
        >
          {useDesktopHeaderLayout ? renderDesktopHeader() : renderMobileHeader()}

          {groupRows.length > 0 && (
            <SectionCard title="Group Assignment">
              {groupRows.map((row) => (
                <InfoRow key={row.label} label={row.label} value={row.value} />
              ))}
            </SectionCard>
          )}

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
        </View>
      </ScrollView>
    </View>
  );
}