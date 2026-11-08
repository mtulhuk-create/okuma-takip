import { LiteBlocked } from "@/components/lite-blocked";
import { LITE } from "@/lib/variant";
import { router } from "expo-router";
import { GroupForm } from "@/components/group-form";
import { Screen } from "@/components/ui";
import { useAction } from "@/lib/api";

/** Lite sürümde yönetici ekranı yok */
export default function NewGroupScreenRoute() {
  return LITE ? <LiteBlocked /> : <NewGroupScreen />;
}

function NewGroupScreen() {
  const action = useAction();
  return (
    <Screen padTop={false}>
      <GroupForm
        submitLabel="Grubu oluştur"
        submitting={action.isPending}
        onSubmit={(body) =>
          action.mutate(
            { name: "createGroup", body },
            { onSuccess: (res) => res.id && router.replace(`/group/${res.id}`) },
          )
        }
      />
    </Screen>
  );
}
