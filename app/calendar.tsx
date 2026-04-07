import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { db } from "../lib/firebaseConfig";

type Task = {
  id: string;
  title: string;
  deadline: string;
  description?: string;
  status?: string;
  groupId?: string;
  groupName?: string;
  groupKind?: string;
  order?: number;
  assignedMemberIds?: string[];
  assignedMemberNames?: string[];
  createdAt?: string;
  updatedAt?: string;
  deadlineAt?: string;
  memberId?: string;
  memberName?: string;
};

type EventItem = {
  id: string;
  eventName: string;
  description?: string;
  eventDate: any;
};

type CalendarProps = {
  userId?: string;
  userRole?: string;
  memberName?: string;
};

type HolidayKind = "national" | "local" | "religious" | "observance";

type Holiday = {
  name: string;
  kind: HolidayKind;
  types: string[];
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function toDateValue(value: any) {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

function eventDateKey(value: any) {
  const d = toDateValue(value);
  return iso(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatEventDate(value: any) {
  const date = toDateValue(value);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeHolidayKind(types: string[]): HolidayKind {
  const lower = types.map((t) => String(t).toLowerCase());

  if (lower.some((t) => t.includes("national"))) return "national";
  if (lower.some((t) => t.includes("local"))) return "local";
  if (lower.some((t) => t.includes("religious"))) return "religious";
  return "observance";
}

function capitalizeFirst(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function fetchCalendarificHolidays(year: number) {
  const apiKey = process.env.EXPO_PUBLIC_CALENDARIFIC_API_KEY;
  const country = process.env.EXPO_PUBLIC_CALENDARIFIC_COUNTRY || "PH";

  if (!apiKey) {
    throw new Error("Missing EXPO_PUBLIC_CALENDARIFIC_API_KEY in .env");
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    country,
    year: String(year),
  });

  const res = await fetch(`https://calendarific.com/api/v2/holidays?${params.toString()}`);
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json?.meta?.error_type || `Calendarific request failed (${res.status})`);
  }

  if (json?.meta?.code !== 200) {
    throw new Error(json?.meta?.error_type || "Calendarific returned an error");
  }

  const holidays: Record<string, Holiday> = {};
  const rows = Array.isArray(json?.response?.holidays) ? json.response.holidays : [];

  rows.forEach((h: any) => {
    const date = typeof h?.date?.iso === "string" ? h.date.iso.slice(0, 10) : "";
    if (!date || !h?.name) return;

    const types: string[] = Array.isArray(h?.type) ? h.type.map((t: any) => String(t)) : [];
    const kind = normalizeHolidayKind(types);

    if (!holidays[date]) {
      holidays[date] = {
        name: String(h.name),
        kind,
        types,
      };
    }
  });

  return holidays;
}

export default function Calendar({ userId, userRole, memberName }: CalendarProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [holidayMap, setHolidayMap] = useState<Record<string, Holiday>>({});
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [holidayError, setHolidayError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [taskSnap, eventSnap] = await Promise.all([
        getDocs(collection(db, "tasks")),
        getDocs(collection(db, "events")),
      ]);

      const taskRows = taskSnap.docs.map((d) => {
        const data = d.data() as Omit<Task, "id">;
        return {
          id: d.id,
          ...data,
        } as Task;
      });

      const eventRows = eventSnap.docs.map((d) => {
        const data = d.data() as Omit<EventItem, "id">;
        return {
          id: d.id,
          ...data,
        } as EventItem;
      });

      setTasks(taskRows);
      setEvents(eventRows);
    };

    load();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadHolidays = async () => {
      setHolidayLoading(true);
      setHolidayError(null);

      try {
        const data = await fetchCalendarificHolidays(year);
        if (!controller.signal.aborted) {
          setHolidayMap(data);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setHolidayMap({});
          setHolidayError(error instanceof Error ? error.message : "Failed to load holidays");
        }
      } finally {
        if (!controller.signal.aborted) {
          setHolidayLoading(false);
        }
      }
    };

    loadHolidays();

    return () => controller.abort();
  }, [year]);

  const visibleTasks = useMemo(() => {
    if (userRole === "admin") return tasks;
    if (!userId) return [];
    return tasks.filter((task) => {
      const assignedIds = task.assignedMemberIds ?? [];
      return assignedIds.includes(userId) || task.memberId === userId;
    });
  }, [tasks, userId, userRole]);

  const taskMap = useMemo(() => {
    const m: Record<string, Task[]> = {};
    visibleTasks.forEach((task) => {
      if (!task.deadline) return;
      if (!m[task.deadline]) m[task.deadline] = [];
      m[task.deadline].push(task);
    });

    Object.keys(m).forEach((key) => {
      m[key].sort((a, b) => {
        const ao = typeof a.order === "number" ? a.order : 0;
        const bo = typeof b.order === "number" ? b.order : 0;
        return ao - bo;
      });
    });

    return m;
  }, [visibleTasks]);

  const eventMap = useMemo(() => {
    const m: Record<string, EventItem[]> = {};
    events.forEach((event) => {
      const key = eventDateKey(event.eventDate);
      if (!m[key]) m[key] = [];
      m[key].push(event);
    });

    Object.keys(m).forEach((key) => {
      m[key].sort((a, b) => toDateValue(a.eventDate).getTime() - toDateValue(b.eventDate).getTime());
    });

    return m;
  }, [events]);

  const holidays = useMemo(() => holidayMap, [holidayMap]);

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const start = first.getDay();
    const total = new Date(year, month + 1, 0).getDate();
    const cells: Array<number | null> = [];

    for (let i = 0; i < start; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
  }, [year, month]);

  const label = new Date(year, month, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const selectedTasks = selectedDate ? taskMap[selectedDate] ?? [] : [];
  const selectedEvents = selectedDate ? eventMap[selectedDate] ?? [] : [];
  const selectedHoliday = selectedDate ? holidays[selectedDate] : undefined;
  const selectedLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const title = userRole === "admin" ? "Calendar" : `${memberName || "Member"}'s Calendar`;
  const today = new Date();
  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());
  const todayShort = today.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const goPrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((v) => v - 1);
    } else {
      setMonth((v) => v - 1);
    }
  };

  const goNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((v) => v + 1);
    } else {
      setMonth((v) => v + 1);
    }
  };

  const getTaskLabel = (task: Task) => task.title;

  const getTaskSubLabel = (task: Task) => {
    const names = task.assignedMemberNames ?? [];
    if (task.groupName && names.length > 0) return `${task.groupName} • ${names.join(", ")}`;
    if (task.groupName) return task.groupName;
    if (names.length > 0) return names.join(", ");
    return task.status ? task.status : "";
  };

  const holidayColor = (kind?: HolidayKind) => {
    if (kind === "national") return "bg-red-50";
    if (kind === "local") return "bg-yellow-50";
    if (kind === "religious") return "bg-violet-50";
    if (kind === "observance") return "bg-blue-50";
    return "bg-white";
  };

  const holidayBadgeColor = (kind?: HolidayKind) => {
    if (kind === "national") return "bg-red-100/80";
    if (kind === "local") return "bg-yellow-100/80";
    if (kind === "religious") return "bg-violet-100/80";
    if (kind === "observance") return "bg-blue-100/80";
    return "bg-slate-100";
  };

  const holidayPanelColor = (kind?: HolidayKind) => {
    if (kind === "national") return "border-red-200 bg-red-50";
    if (kind === "local") return "border-yellow-200 bg-yellow-50";
    if (kind === "religious") return "border-violet-200 bg-violet-50";
    if (kind === "observance") return "border-blue-200 bg-blue-50";
    return "border-slate-200 bg-slate-50";
  };

  const holidayTextColor = (kind?: HolidayKind) => {
    if (kind === "national") return "text-red-700";
    if (kind === "local") return "text-yellow-700";
    if (kind === "religious") return "text-violet-700";
    if (kind === "observance") return "text-blue-700";
    return "text-slate-700";
  };

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-3 pt-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-3xl font-extrabold text-slate-900">{title}</Text>
            <Text className="mt-1 text-sm text-slate-500">
              Tap any date to view tasks, events, and holidays
            </Text>
          </View>

          <View className="rounded-full bg-slate-100 px-3 py-1.5">
            <Text className="text-xs font-bold text-slate-700">{todayShort}</Text>
          </View>
        </View>

        {holidayLoading ? (
          <View className="mt-2 flex-row items-center gap-2">
            <ActivityIndicator size="small" />
            <Text className="text-xs text-slate-500">Loading holidays from Calendarific...</Text>
          </View>
        ) : holidayError ? (
          <Text className="mt-2 text-xs text-rose-600">{holidayError}</Text>
        ) : null}
      </View>

      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
        <Pressable
          onPress={goPrevMonth}
          className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200"
        >
          <Ionicons name="chevron-back" size={20} color="#111827" />
        </Pressable>

        <View className="items-center">
          <Text className="text-lg font-extrabold text-slate-900">{label}</Text>
          <Text className="mt-0.5 text-xs text-slate-500">
            {new Date().getFullYear() === year && new Date().getMonth() === month
              ? "This month"
              : "Browsing month"}
          </Text>
        </View>

        <Pressable
          onPress={goNextMonth}
          className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200"
        >
          <Ionicons name="chevron-forward" size={20} color="#111827" />
        </Pressable>
      </View>

      <View className="flex-row border-b border-slate-200 bg-white">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <View key={d} className="flex-1 items-center border-r border-slate-200 py-2 last:border-r-0">
            <Text className="text-xs font-bold text-slate-500">{d}</Text>
          </View>
        ))}
      </View>

      <ScrollView className="flex-1" contentContainerClassName="pb-6">
        <View className="bg-white">
          {Array.from({ length: days.length / 7 }).map((_, row) => (
            <View key={row} className="flex-row">
              {days.slice(row * 7, row * 7 + 7).map((day, index) => {
                const date = day ? iso(year, month, day) : "";
                const tasksForDay = day ? taskMap[date] ?? [] : [];
                const eventsForDay = day ? eventMap[date] ?? [] : [];
                const holiday = day ? holidays[date] : undefined;
                const isToday = date === todayIso;
                const isSelected = selectedDate === date;
                const hasEvent = eventsForDay.length > 0;

                return (
                  <Pressable
                    key={`${row}-${index}`}
                    onPress={() => day && setSelectedDate(date)}
                    className={`min-h-[112px] flex-1 border-b border-r border-slate-200 p-1.5 ${
                      index === 6 ? "border-r-0" : ""
                    } ${
                      isSelected
                        ? "bg-blue-50"
                        : isToday
                          ? `${holiday ? holidayColor(holiday.kind) : "bg-sky-50"} border-2 border-blue-500`
                          : holiday
                            ? holidayColor(holiday.kind)
                            : hasEvent
                              ? "bg-indigo-50"
                              : "bg-white"
                    }`}
                  >
                    <View className="flex-row items-start justify-between">
                      <View
                        className={`min-h-[26px] min-w-[26px] items-center justify-center rounded-full ${
                          isToday ? "bg-blue-600" : "bg-transparent"
                        }`}
                      >
                        <Text
                          className={`text-[13px] font-extrabold ${
                            isToday ? "text-white" : day ? "text-slate-900" : "text-slate-300"
                          }`}
                        >
                          {day ?? ""}
                        </Text>
                      </View>
                    </View>

                    <View className="mt-1.5">
                      {holiday ? (
                        <View className={`mb-1 rounded-md px-1.5 py-1 ${holidayBadgeColor(holiday.kind)}`}>
                          <Text
                            numberOfLines={2}
                            className={`text-[10px] font-bold leading-3 ${holidayTextColor(holiday.kind)}`}
                          >
                            {holiday.name}
                          </Text>
                        </View>
                      ) : null}

                      {eventsForDay.slice(0, 2).map((event) => (
                        <View key={event.id} className="mb-1 rounded-md bg-indigo-100/80 px-1.5 py-1">
                          <Text numberOfLines={1} className="text-[11px] font-bold leading-3 text-slate-900">
                            {event.eventName}
                          </Text>
                          {event.description ? (
                            <Text numberOfLines={1} className="mt-0.5 text-[9px] leading-3 text-slate-600">
                              {event.description}
                            </Text>
                          ) : null}
                        </View>
                      ))}

                      {tasksForDay.slice(0, 3).map((task) => (
                        <View key={task.id} className="mb-1 rounded-md bg-sky-100/70 px-1.5 py-1">
                          <Text numberOfLines={1} className="text-[11px] font-bold leading-3 text-slate-900">
                            {getTaskLabel(task)}
                          </Text>
                          {getTaskSubLabel(task) ? (
                            <Text numberOfLines={1} className="mt-0.5 text-[9px] leading-3 text-slate-600">
                              {getTaskSubLabel(task)}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={!!selectedDate} transparent animationType="fade" onRequestClose={() => setSelectedDate(null)}>
        <Pressable className="flex-1 justify-center bg-black/50 p-5" onPress={() => setSelectedDate(null)}>
          <Pressable onPress={() => {}} className="max-h-[80%] rounded-2xl bg-white p-4 shadow-xl">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-lg font-extrabold text-slate-900">{selectedLabel}</Text>
                <Text className="mt-1 text-sm text-slate-500">
                  {selectedTasks.length} task{selectedTasks.length === 1 ? "" : "s"} scheduled
                  {selectedEvents.length > 0
                    ? ` • ${selectedEvents.length} event${selectedEvents.length === 1 ? "" : "s"}`
                    : ""}
                  {selectedHoliday ? ` • ${selectedHoliday.name}` : ""}
                </Text>
              </View>

              <Pressable
                onPress={() => setSelectedDate(null)}
                className="h-9 w-9 items-center justify-center rounded-full bg-slate-100"
              >
                <Ionicons name="close" size={20} color="#111827" />
              </Pressable>
            </View>

            <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
              {selectedHoliday ? (
                <View className={`mb-3 border p-3 ${holidayPanelColor(selectedHoliday.kind)}`}>
                  <Text className={`text-[15px] font-extrabold ${holidayTextColor(selectedHoliday.kind)}`}>
                    {selectedHoliday.name}
                  </Text>
                  <Text className={`mt-1 text-[12px] font-semibold ${holidayTextColor(selectedHoliday.kind)}`}>
                    {capitalizeFirst(selectedHoliday.kind)} Holiday
                  </Text>
                </View>
              ) : null}

              {selectedEvents.length > 0 ? (
                <View className="mb-3">
                  <Text className="mb-2 text-[13px] font-extrabold text-slate-700">Events</Text>
                  {selectedEvents.map((event) => (
                    <View key={event.id} className="mb-3 border border-indigo-200 bg-indigo-50 p-3">
                      <Text className="text-[15px] font-extrabold text-slate-900">{event.eventName}</Text>
                      <Text className="mt-1 text-[13px] text-slate-600">{formatEventDate(event.eventDate)}</Text>
                      {event.description ? (
                        <Text className="mt-1 text-[13px] text-slate-600">{event.description}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {selectedTasks.length > 0 ? (
                <View>
                  <Text className="mb-2 text-[13px] font-extrabold text-slate-700">Tasks</Text>
                  {selectedTasks.map((task) => (
                    <View key={task.id} className="mb-3 border border-slate-200 bg-slate-50 p-3">
                      <Text className="text-[15px] font-extrabold text-slate-900">{task.title}</Text>

                      {task.description ? (
                        <Text className="mt-1 text-[13px] text-slate-600">{task.description}</Text>
                      ) : null}

                      <Text className="mt-1 text-[13px] text-slate-600">
                        Group: {task.groupName || "N/A"}
                      </Text>

                      {task.assignedMemberNames?.length ? (
                        <Text className="mt-1 text-[13px] text-slate-600">
                          Assigned: {task.assignedMemberNames.join(", ")}
                        </Text>
                      ) : null}

                      {task.status ? (
                        <Text className="mt-1 text-[13px] text-slate-600">Status: {task.status}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : selectedHoliday || selectedEvents.length > 0 ? null : (
                <View className="border border-slate-200 bg-slate-50 p-3">
                  <Text className="text-sm text-slate-700">No tasks for this day.</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}