import { ScrollView, View } from 'react-native';

import { ScreenBar } from '@/components/screen-bar';
import { Card, EmptyState, IconBadge, Txt } from '@/components/ui';
import { useApp } from '@/store/app-store';

const ITEMS = [
  { icon: 'book-plus-outline', title: 'New booklet: Midface Fractures', text: 'Oral Surgery now includes 8 topics with ministry MCQs.', when: 'Today' },
  { icon: 'robot-happy-outline', title: 'Ask AI is here', text: 'Open any topic and tap “Ask AI” to ask about the subject in front of you.', when: 'Yesterday' },
  { icon: 'trophy-outline', title: 'Keep your streak', text: 'Finish one topic a day to stay on track for finals.', when: 'This week' },
];

export default function Notifications() {
  const { palette: p, notifications } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScreenBar title="Notifications" />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
        {!notifications ? (
          <EmptyState icon="bell-off-outline" title="Notifications are off" text="Turn them on from Profile → Notifications." />
        ) : (
          ITEMS.map((n) => (
            <Card key={n.title} style={{ flexDirection: 'row', gap: 12, padding: 14 }}>
              <IconBadge name={n.icon} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt weight="bold">{n.title}</Txt>
                <Txt muted size={13.5} style={{ lineHeight: 20 }}>{n.text}</Txt>
                <Txt muted size={12} style={{ marginTop: 4 }}>{n.when}</Txt>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
