import { collection, getDocs } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { db } from "../../lib/firebaseConfig";

type Task = {
  id: string;
  memberName: string;
  title: string;
  deadline: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function PlotCalendar() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(collection(db, "tasks"));
      setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, "id">) })));
    };
    load();
  }, []);

  const map = useMemo(() => {
    const m: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      if (!m[task.deadline]) m[task.deadline] = [];
      m[task.deadline].push(task);
    });
    return m;
  }, [tasks]);

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

  const label = new Date(year, month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  const selectedTasks = selectedDate ? map[selectedDate] ?? [] : [];
  const selectedLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>Plot Calendar</Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable
            onPress={() => {
              if (month === 0) {
                setMonth(11);
                setYear((v) => v - 1);
              } else {
                setMonth((v) => v - 1);
              }
            }}
            style={{ borderWidth: 1, padding: 10, borderRadius: 10 }}
          >
            <Text>Prev</Text>
          </Pressable>

          <Text style={{ fontSize: 18, fontWeight: "700" }}>{label}</Text>

          <Pressable
            onPress={() => {
              if (month === 11) {
                setMonth(0);
                setYear((v) => v + 1);
              } else {
                setMonth((v) => v + 1);
              }
            }}
            style={{ borderWidth: 1, padding: 10, borderRadius: 10 }}
          >
            <Text>Next</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row" }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <View key={d} style={{ flex: 1, paddingVertical: 8, alignItems: "center" }}>
              <Text style={{ fontWeight: "700" }}>{d}</Text>
            </View>
          ))}
        </View>

        <View style={{ gap: 8 }}>
          {Array.from({ length: days.length / 7 }).map((_, row) => (
            <View key={row} style={{ flexDirection: "row", minHeight: 92 }}>
              {days.slice(row * 7, row * 7 + 7).map((day, index) => {
                const date = day ? iso(year, month, day) : "";
                const tasksForDay = day ? map[date] ?? [] : [];
                const isToday =
                  date &&
                  date ===
                    iso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

                return (
                  <Pressable
                    key={`${row}-${index}`}
                    onPress={() => day && setSelectedDate(date)}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      padding: 6,
                      minHeight: 92,
                      backgroundColor: isToday ? "#f0f7ff" : "#fff",
                    }}
                  >
                    <Text style={{ fontWeight: "700" }}>{day ?? ""}</Text>
                    {tasksForDay.slice(0, 2).map((task) => (
                      <Text key={task.id} style={{ fontSize: 11 }}>
                        {task.memberName}
                      </Text>
                    ))}
                    {tasksForDay.length > 2 ? (
                      <Text style={{ fontSize: 11 }}>+{tasksForDay.length - 2} more</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={!!selectedDate}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDate(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            padding: 20,
          }}
          onPress={() => setSelectedDate(null)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 18,
              maxHeight: "80%",
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 8 }}>
              {selectedLabel}
            </Text>

            <Text style={{ fontSize: 14, fontWeight: "700", marginBottom: 12 }}>
              {selectedTasks.length} item{selectedTasks.length === 1 ? "" : "s"} scheduled
            </Text>

            <ScrollView>
              {selectedTasks.length > 0 ? (
                selectedTasks.map((task) => (
                  <View
                    key={task.id}
                    style={{
                      borderWidth: 1,
                      borderColor: "#ddd",
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "700" }}>{task.title}</Text>
                    <Text style={{ marginTop: 4 }}>Member: {task.memberName}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: 14 }}>No tasks for this day.</Text>
              )}
            </ScrollView>

            <Pressable
              onPress={() => setSelectedDate(null)}
              style={{
                marginTop: 14,
                alignSelf: "flex-end",
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
              }}
            >
              <Text>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}