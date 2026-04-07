import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, Timestamp, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../lib/firebaseConfig";

type EventItem = {
  id: string;
  eventName: string;
  description: string;
  eventDate: any;
};

type Props = {
  userRole?: string;
};

const eventsRef = collection(db, "events");

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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isOverdue(value: any) {
  return startOfDay(toDateValue(value)).getTime() < startOfDay(new Date()).getTime();
}

function formatDate(value: any) {
  const date = toDateValue(value);
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function EventScreen({ userRole = "" }: Props) {
  const isAdmin = userRole === "admin";
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eventName, setEventName] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(new Date());

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => toDateValue(a.eventDate).getTime() - toDateValue(b.eventDate).getTime());
  }, [events]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(eventsRef, orderBy("eventDate", "asc")));
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<EventItem, "id">),
      }));

      const normalized = data.sort((a, b) => toDateValue(a.eventDate).getTime() - toDateValue(b.eventDate).getTime());
      setEvents(normalized);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setEventName("");
    setDescription("");
    setEventDate(new Date());
    setShowPicker(false);
  };

  const openCreate = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEdit = (item: EventItem) => {
    if (!isAdmin) return;
    setEditingId(item.id);
    setEventName(item.eventName || "");
    setDescription(item.description || "");
    setEventDate(toDateValue(item.eventDate));
    setShowPicker(false);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    resetForm();
  };

  const saveEvent = async () => {
    const name = eventName.trim();
    const desc = description.trim();

    if (!name) {
      Alert.alert("Missing event name", "Please enter an event name.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        eventName: name,
        description: desc,
        eventDate: Timestamp.fromDate(eventDate),
      };

      if (editingId) {
        await updateDoc(doc(db, "events", editingId), payload);
      } else {
        await addDoc(eventsRef, payload);
      }

      await loadEvents();
      closeModal();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (item: EventItem) => {
    Alert.alert("Delete event", `Delete "${item.eventName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "events", item.id));
            await loadEvents();
          } catch (error: any) {
            Alert.alert("Error", error?.message || "Something went wrong.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <View className="flex-1 px-4 pt-4">
        <View className="mb-4">
          <Text className="text-[24px] font-extrabold text-gray-900">Event</Text>
          <Text className="mt-1 text-[13px] font-medium text-gray-500">See upcoming church events</Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" />
          </View>
        ) : sortedEvents.length === 0 ? (
          <View className="flex-1 items-center justify-center rounded-3xl bg-white px-6">
            <MaterialIcons name="event-note" size={48} color="#9CA3AF" />
            <Text className="mt-4 text-[18px] font-extrabold text-gray-900">No event yet</Text>
            <Text className="mt-2 text-center text-[13px] font-medium text-gray-500">
              {isAdmin ? "Tap the add button to create the first event." : "Please check back later."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={sortedEvents}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerClassName="pb-28"
            renderItem={({ item }) => {
              const overdue = isOverdue(item.eventDate);
              const Card = isAdmin ? Pressable : View;

              return (
                <Card
                  onPress={isAdmin ? () => openEdit(item) : undefined}
                  className="mb-3 rounded-3xl border border-gray-200 bg-white p-4"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-[18px] font-extrabold text-gray-900">{item.eventName}</Text>
                    </View>
                    {isAdmin ? (
                      <View className="flex-row items-center gap-2">
                        <Pressable
                          onPress={() => openEdit(item)}
                          className="h-9 w-9 items-center justify-center rounded-full bg-gray-100"
                        >
                          <MaterialIcons name="edit" size={20} color="#111827" />
                        </Pressable>
                        <Pressable
                          onPress={() => confirmDelete(item)}
                          className="h-9 w-9 items-center justify-center rounded-full bg-gray-100"
                        >
                          <MaterialIcons name="delete-outline" size={20} color="#DC2626" />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>

                  {item.description ? (
                    <Text className="mt-3 text-[14px] leading-5 text-gray-700">{item.description}</Text>
                  ) : null}

                  <Text className={`mt-3 text-[13px] font-semibold ${overdue ? "text-red-600" : "text-blue-600"}`}>
                    Date: {formatDate(item.eventDate)}
                  </Text>
                </Card>
              );
            }}
          />
        )}

        {isAdmin ? (
          <Pressable
            onPress={openCreate}
            className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-blue-600 shadow-2xl"
          >
            <MaterialIcons name="add" size={30} color="#FFFFFF" />
          </Pressable>
        ) : null}

        <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
          <View className="flex-1 bg-black/40 px-4 justify-center">
            <View className="rounded-3xl bg-white p-5">
              <Text className="text-[20px] font-extrabold text-gray-900">
                {editingId ? "Edit Event" : "Add Event"}
              </Text>

              <View className="mt-4">
                <Text className="mb-2 text-[13px] font-bold text-gray-700">Event Name</Text>
                <TextInput
                  value={eventName}
                  onChangeText={setEventName}
                  placeholder="Enter event name"
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] text-gray-900"
                />
              </View>

              <View className="mt-4">
                <Text className="mb-2 text-[13px] font-bold text-gray-700">Date</Text>
                <Pressable
                  onPress={() => setShowPicker((prev) => !prev)}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <Text className="text-[15px] text-gray-900">{formatDate(eventDate)}</Text>
                </Pressable>
              </View>

              {showPicker ? (
                <View className="mt-3 overflow-hidden rounded-2xl border border-gray-200">
                  <DateTimePicker
                    value={eventDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(_, selectedDate) => {
                      if (selectedDate) setEventDate(selectedDate);
                      if (Platform.OS === "android") setShowPicker(false);
                    }}
                  />
                </View>
              ) : null}

              <View className="mt-4">
                <Text className="mb-2 text-[13px] font-bold text-gray-700">Description</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Enter description"
                  multiline
                  textAlignVertical="top"
                  className="min-h-[110px] rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] text-gray-900"
                />
              </View>

              <View className="mt-5 flex-row gap-3">
                <Pressable onPress={closeModal} className="flex-1 items-center justify-center rounded-2xl bg-gray-200 px-4 py-4">
                  <Text className="text-[15px] font-bold text-gray-900">Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={saveEvent}
                  disabled={saving}
                  className={`flex-1 items-center justify-center rounded-2xl px-4 py-4 ${saving ? "bg-blue-300" : "bg-blue-600"}`}
                >
                  <Text className="text-[15px] font-bold text-white">{editingId ? "Save" : "Create"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}