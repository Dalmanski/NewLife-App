import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity } from "react-native";
import { db } from "../lib/firebaseConfig";

export default function ManageMembers() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [contact, setContact] = useState("");
  const [civilStatus, setCivilStatus] = useState("");
  const [activeMinistry, setActiveMinistry] = useState("");
  const [coreGroup, setCoreGroup] = useState("");

  const addMember = async () => {
    if (!name || !password || !contact || !civilStatus || !activeMinistry || !coreGroup)
      return Alert.alert("Error", "Fill all fields");

    try {
      const snap = await getDocs(collection(db, "users"));
      const id = snap.size + 1;

      await setDoc(doc(db, "users", String(id)), {
        memberId: id,
        name,
        password,
        contact,
        civilStatus,
        activeMinistry,
        coreGroup,
        role: "member"
      });

      setName("");
      setPassword("");
      setContact("");
      setCivilStatus("");
      setActiveMinistry("");
      setCoreGroup("");

      Alert.alert("Success", "Member added");
    } catch {
      Alert.alert("Error", "Failed to add member");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20, gap: 12 }}>
      <TextInput value={name} onChangeText={setName} placeholder="Name" style={{ borderWidth: 1, padding: 12 }} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={{ borderWidth: 1, padding: 12 }} />
      <TextInput value={contact} onChangeText={setContact} placeholder="Contact" style={{ borderWidth: 1, padding: 12 }} />
      <TextInput value={civilStatus} onChangeText={setCivilStatus} placeholder="Civil Status" style={{ borderWidth: 1, padding: 12 }} />
      <TextInput value={activeMinistry} onChangeText={setActiveMinistry} placeholder="Active Ministry" style={{ borderWidth: 1, padding: 12 }} />
      <TextInput value={coreGroup} onChangeText={setCoreGroup} placeholder="Core Group" style={{ borderWidth: 1, padding: 12 }} />
      <TouchableOpacity onPress={addMember} style={{ borderWidth: 1, padding: 12, alignItems: "center" }}>
        <Text>Add Members</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}