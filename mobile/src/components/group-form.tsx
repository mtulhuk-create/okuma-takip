import { useState } from "react";
import { View } from "react-native";
import type { Group, PenaltyMode } from "@/lib/types";
import { TimeField } from "./pickers";
import { Body, Button, Card, Input, Muted, Row, Segmented, Title } from "./ui";

export type GroupFormValues = Record<string, string | number>;

export function GroupForm({ group, onSubmit, submitting, submitLabel }: { group?: Group; onSubmit: (v: GroupFormValues) => void; submitting?: boolean; submitLabel: string }) {
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">(group?.visibility ?? "PRIVATE");
  const [minPages, setMinPages] = useState(String(group?.minPages ?? 10));
  const [penaltyMode, setPenaltyMode] = useState<PenaltyMode>(group?.penaltyMode ?? "FIXED");
  const [penaltyAmount, setPenaltyAmount] = useState(String(group?.penaltyAmount ?? 20));
  const [startMinute, setStartMinute] = useState(group?.startMinute ?? 0);
  const [deadlineMinute, setDeadlineMinute] = useState(group?.deadlineMinute ?? 1439);
  const [reminderHours, setReminderHours] = useState(String(group?.reminderHours ?? 2));
  const [iban, setIban] = useState(group?.iban ?? "");
  const [ibanName, setIbanName] = useState(group?.ibanName ?? "");

  const time = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  return (
    <View style={{ gap: 14 }}>
      <Input label="Grup adı" value={name} onChangeText={setName} placeholder="Örn. Sabah Okurları" maxLength={80} />
      <Input label="Açıklama" value={description} onChangeText={setDescription} multiline maxLength={500} />
      <Segmented
        value={visibility}
        onChange={setVisibility}
        options={[
          { value: "PRIVATE", label: "🔒 Özel", hint: "Sadece davetle" },
          { value: "PUBLIC", label: "🌍 Herkese açık", hint: "Listede görünür, istek alınır" },
        ]}
      />

      <Card>
        <Title>📖 Okuma kuralları</Title>
        <Input label="Günlük en az sayfa (alt sınır)" value={minPages} onChangeText={setMinPages} keyboardType="number-pad" />
        <Muted>Her üye kendi günlük hedefini belirler; bu değerin altına inemez.</Muted>
        <Segmented
          value={penaltyMode}
          onChange={setPenaltyMode}
          options={[
            { value: "FIXED", label: "Gün başına sabit" },
            { value: "PER_PAGE", label: "Eksik sayfa başına" },
          ]}
        />
        <Input label="Ceza tutarı (TL)" value={penaltyAmount} onChangeText={setPenaltyAmount} keyboardType="number-pad" />
      </Card>

      <Card>
        <Title>⏰ Zamanlama (Türkiye saati)</Title>
        <Row>
          <TimeField label="Yeni gün başlangıcı" minute={startMinute} onChange={setStartMinute} />
          <TimeField label="Son bildirim saati" minute={deadlineMinute} onChange={setDeadlineMinute} />
        </Row>
        <Muted>Son saat başlangıçtan önceyse ertesi güne sayılır (örn. 06:00 başlangıç, 02:00 bitiş).</Muted>
        <Input label="Son saatten kaç saat önce uyarı?" value={reminderHours} onChangeText={setReminderHours} keyboardType="number-pad" />
        <Muted>0 = uyarı yok. Son 10 dakikada geri sayım bildirimi her zaman gönderilir.</Muted>
      </Card>

      <Card>
        <Title>💳 Ceza ödemeleri</Title>
        <Input label="IBAN" value={iban} onChangeText={setIban} autoCapitalize="characters" placeholder="TR00 0000 0000 0000 0000 0000 00" />
        <Input label="Alıcı adı soyadı" value={ibanName} onChangeText={setIbanName} />
      </Card>

      <Button
        title={submitLabel}
        loading={submitting}
        onPress={() =>
          onSubmit({
            ...(group ? { groupId: group.id } : {}),
            name,
            description,
            visibility,
            minPages,
            penaltyMode,
            penaltyAmount,
            startTime: time(startMinute),
            deadlineTime: time(deadlineMinute),
            reminderHours,
            iban,
            ibanName,
          })
        }
      />
      {!group && <Body style={{ textAlign: "center", opacity: 0.6 }}>Grubu kurunca otomatik olarak yönetici olursun.</Body>}
    </View>
  );
}
