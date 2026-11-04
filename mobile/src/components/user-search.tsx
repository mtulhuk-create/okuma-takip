import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useAction, useApiFetch } from "@/lib/api";
import { Avatar, Badge, Body, Button, Input, Muted, Row } from "./ui";

type Result = { id: string; name: string; username: string | null; imageUrl: string | null; isMember: boolean; invited: boolean };

export function UserSearch({ groupId }: { groupId: string }) {
  const fetcher = useApiFetch();
  const action = useAction();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isFetching } = useQuery({
    queryKey: ["user-search", groupId, debounced],
    queryFn: () => fetcher<{ users: Result[] }>(`/api/users/search?q=${encodeURIComponent(debounced)}&groupId=${groupId}`),
    enabled: debounced.length >= 2,
  });
  const users = debounced.length >= 2 ? (data?.users ?? []) : [];

  return (
    <View style={{ gap: 10 }}>
      <Input placeholder="🔍 İsim veya kullanıcı adı ara..." value={q} onChangeText={setQ} autoCapitalize="none" />
      {isFetching && <Muted>Aranıyor...</Muted>}
      {!isFetching && debounced.length >= 2 && users.length === 0 && <Muted>Kullanıcı bulunamadı. Kişinin uygulamaya en az bir kez giriş yapmış olması gerekir.</Muted>}
      {users.map((u) => (
        <Row key={u.id}>
          <Avatar name={u.name} uri={u.imageUrl} />
          <View style={{ flex: 1 }}>
            <Body numberOfLines={1} style={{ fontFamily: "Poppins_600SemiBold" }}>
              {u.name}
            </Body>
            {u.username && <Muted>@{u.username}</Muted>}
          </View>
          {u.isMember ? (
            <Badge text="Üye" tone="success" />
          ) : u.invited ? (
            <Badge text="Davet edildi" tone="warning" />
          ) : (
            <Button
              small
              title="Davet et"
              loading={action.isPending && action.variables?.body?.userId === u.id}
              onPress={() => action.mutate({ name: "inviteUser", body: { groupId, userId: u.id } })}
            />
          )}
        </Row>
      ))}
    </View>
  );
}
