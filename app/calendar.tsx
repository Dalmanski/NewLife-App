import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
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

type HolidayKind = "regular" | "special";

type Holiday = {
  name: string;
  kind: HolidayKind;
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

const isoFromDate = (date: Date) => iso(date.getFullYear(), date.getMonth(), date.getDate());

const shiftDate = (date: Date, days: number) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
};

const getEasterSunday = (year: number) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
};

const getLastMondayOfMonth = (year: number, month: number) => {
  const d = new Date(year, month + 1, 0);
  while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
  return d;
};

const getOfficialHolidays = (year: number): Record<string, Holiday> => {
  const holidays: Record<string, Holiday> = {};
  const add = (date: string, name: string, kind: HolidayKind = "regular") => {
    holidays[date] = { name, kind };
  };

  add(`${year}-01-01`, "New Year");
  add(`${year}-04-09`, "Araw ng Kagitingan");
  add(`${year}-05-01`, "Labor Day");
  add(`${year}-06-12`, "Independence Day");
  add(isoFromDate(getLastMondayOfMonth(year, 7)), "National Heroes Day");
  add(`${year}-11-30`, "Bonifacio Day");
  add(`${year}-12-25`, "Christmas Day");
  add(`${year}-12-30`, "Rizal Day");

  add(`${year}-08-21`, "Ninoy Aquino Day", "special");
  add(`${year}-11-01`, "All Saints Day", "special");
  add(`${year}-11-02`, "All Souls Day", "special");
  add(`${year}-12-08`, "Immaculate Conception", "special");
  add(`${year}-12-24`, "Christmas Eve", "special");
  add(`${year}-12-31`, "Last Day of Year", "special");

  const easter = getEasterSunday(year);
  add(isoFromDate(shiftDate(easter, -3)), "Maundy Thursday");
  add(isoFromDate(shiftDate(easter, -2)), "Good Friday");
  add(isoFromDate(shiftDate(easter, 1)), "Black Saturday", "special");

  if (year === 2026) {
    add(`${year}-02-17`, "Chinese New Year", "special");
    add(`${year}-03-20`, "Eid'l Fitr");
  }

  return holidays;
};

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

export default function Calendar({ userId, userRole, memberName }: CalendarProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  const holidays = useMemo(() => getOfficialHolidays(year), [year]);

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
  const todayIso = iso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

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

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-3 pt-4">
        <Text className="text-3xl font-extrabold text-slate-900">{title}</Text>
        <Text className="mt-1 text-sm text-slate-500">
          Tap any date to view tasks, events, and official holidays
        </Text>
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
                          ? "bg-sky-50"
                          : holiday
                            ? holiday.kind === "regular"
                              ? "bg-amber-50"
                              : "bg-rose-50"
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
                        <View
                          className={`mb-1 rounded-md px-1.5 py-1 ${
                            holiday.kind === "regular" ? "bg-amber-100/70" : "bg-rose-100/70"
                          }`}
                        >
                          <Text numberOfLines={2} className="text-[10px] font-bold leading-3 text-slate-900">
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
                  {selectedEvents.length > 0 ? ` • ${selectedEvents.length} event${selectedEvents.length === 1 ? "" : "s"}` : ""}
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
                <View
                  className={`mb-3 border p-3 ${
                    selectedHoliday.kind === "regular"
                      ? "border-amber-200 bg-amber-50"
                      : "border-rose-200 bg-rose-50"
                  }`}
                >
                  <Text className="text-[15px] font-extrabold text-slate-900">{selectedHoliday.name}</Text>
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