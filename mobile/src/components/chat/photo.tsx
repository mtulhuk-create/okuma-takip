import { Image } from "expo-image";
import { SendHorizontal, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, StatusBar, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Picked } from "@/lib/photo";
import { fonts, useColors } from "@/lib/theme";
import type { ChatMessage } from "@/lib/types";

/** Gönderilecek fotoğrafın önizlemesi ve açıklaması */
export function PhotoSendSheet({ photo, initialCaption, onClose, onSend }: { photo: Picked | null; initialCaption: string; onClose: () => void; onSend: (caption: string) => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState(initialCaption);
  const [shown, setShown] = useState(photo);
  // Yeni fotoğraf seçilince açıklama baştan alınır
  if (photo !== shown) {
    setShown(photo);
    setCaption(initialCaption);
  }
  return (
    <Modal visible={!!photo} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top, paddingBottom: insets.bottom + 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", padding: 8 }}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Vazgeç" style={{ padding: 6 }}>
            <X size={24} color="#fff" />
          </Pressable>
        </View>
        {photo && <Image source={{ uri: photo.uri }} style={{ flex: 1 }} contentFit="contain" />}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, paddingHorizontal: 8, paddingTop: 8 }}>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Açıklama ekle (isteğe bağlı)"
            placeholderTextColor={c.mutedForeground}
            multiline
            maxLength={1000}
            style={{ flex: 1, maxHeight: 110, minHeight: 46, backgroundColor: c.card, borderRadius: 23, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.regular, fontSize: 15, color: c.foreground }}
          />
          <Pressable
            onPress={() => onSend(caption.trim())}
            accessibilityLabel="Gönder"
            style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, backgroundColor: c.primary, opacity: pressed ? 0.8 : 1, alignItems: "center", justifyContent: "center" })}
          >
            <SendHorizontal size={20} color={c.primaryForeground} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Sohbetteki fotoğraf: küçük sürümü gösterir (az veri, az bellek), dokununca büyük sürüm tam ekran */
export function ChatPhoto({ m, color }: { m: ChatMessage; color: string }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const img = m.image;
  if (!img) return null;
  // Çok uzun ya da çok yatay fotoğraflar sohbeti kaplamasın
  const ratio = Math.min(1.6, Math.max(0.7, (img.w || 4) / (img.h || 3)));
  return (
    <>
      <Pressable onPress={() => !m.pending && setOpen(true)} accessibilityLabel="Fotoğrafı büyüt" style={{ width: 230, aspectRatio: ratio, marginHorizontal: -6, marginTop: 2, marginBottom: 3, borderRadius: 9, overflow: "hidden", backgroundColor: "#0001" }}>
        <Image source={{ uri: img.thumb }} recyclingKey={m.id} style={{ flex: 1 }} contentFit="cover" transition={120} />
        {m.pending && (
          <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#0004" }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: "#fff", backgroundColor: "#0009", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, overflow: "hidden" }}>%{Math.round((m.progress ?? 0) * 100)}</Text>
          </View>
        )}
      </Pressable>
      {!!m.text && <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color, maxWidth: 230 }}>{m.text}</Text>}
      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <StatusBar barStyle="light-content" />
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", padding: 8 }}>
            <X size={24} color="#fff" />
          </View>
          {/* Önce küçük sürüm (önbellekte) görünür, büyüğü yüklenince yerini alır */}
          <Image source={{ uri: img.full }} placeholder={{ uri: img.thumb }} placeholderContentFit="contain" style={{ flex: 1 }} contentFit="contain" transition={150} />
          {!!m.text && <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: "#fff", textAlign: "center", padding: 12 }}>{m.text}</Text>}
        </Pressable>
      </Modal>
    </>
  );
}
