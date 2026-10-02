import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { C, F, hsl, hue } from '@/theme';
import { initials } from '@/utils/format';
import type { User } from '@/types/models';

/** Face with initials underneath while the photo loads */
export const Avatar = memo(({ user, size = 32, ring }: { user?: User | null; size?: number; ring?: string }) => {
  if (!user) return null;
  return (
    <View style={[st.av, { width: size, height: size, borderRadius: size / 2, backgroundColor: hsl(hue(user.id), 28, 30) }, ring ? { borderWidth: 2, borderColor: ring } : null]}>
      <Text style={{ color: '#fff', fontFamily: F.bodyBold, fontSize: size * 0.36 }}>{initials(user.name)}</Text>
      {user.avatar ? <Image source={{ uri: user.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={user.id} transition={120} /> : null}
    </View>
  );
});

/** "Jack, Grace + 5" faces */
export const AvatarStack = memo(({ users, max = 5, size = 28, border = C.surface }: { users: (User | undefined)[]; max?: number; size?: number; border?: string }) => {
  const list = users.filter(Boolean) as User[];
  const shown = list.slice(0, max);
  const more = list.length - shown.length;
  return (
    <View style={st.stack}>
      {shown.map((u, i) => (
        <View key={u.id} style={[{ marginLeft: i ? -size * 0.28 : 0, borderRadius: size, borderWidth: 2, borderColor: border }]}>
          <Avatar user={u} size={size - 4} />
        </View>
      ))}
      {more > 0 ? (
        <View style={[st.more, { marginLeft: -size * 0.28, width: size, height: size, borderRadius: size / 2, borderColor: border }]}>
          <Text style={{ color: C.text2, fontFamily: F.bodyBold, fontSize: size * 0.32 }}>+{more}</Text>
        </View>
      ) : null}
    </View>
  );
});

const st = StyleSheet.create({
  av: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  stack: { flexDirection: 'row', alignItems: 'center' },
  more: { backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
