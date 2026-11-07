import { BellOff, Bot, BookPlus, FileUp, Flame } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { Card, EmptyState, Icon, TopBar, Txt } from '@/components/ui';
import { Type } from '@/constants/theme';
import { useApp } from '@/store/app-store';

const ITEMS = [
  { icon: FileUp, title: 'Upload your own notes', text: 'Turn any PDF, Word or PowerPoint file into a booklet with practice questions.', when: 'New' },
  { icon: BookPlus, title: 'Midface Fractures is ready', text: 'Oral Surgery now has 8 topics with ministry and instructor MCQs.', when: 'Today' },
  { icon: Bot, title: 'Ask AI is here', text: 'Open any topic and ask about the subject in front of you.', when: 'Yesterday' },
  { icon: Flame, title: 'Keep your streak', text: 'One topic a day keeps you on track for finals.', when: 'This week' },
];

export default function Notifications() {
  const { palette: p, notifications } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopBar title="Notifications" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
        {!notifications ? (
          <EmptyState icon={BellOff} title="Notifications are off" text="Turn them on from Profile → Notifications." />
        ) : (
          ITEMS.map((n) => (
            <Card key={n.title} style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 20 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon as={n.icon} size={17} color={p.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Txt weight="semibold" size={Type.small} style={{ flex: 1 }}>{n.title}</Txt>
                  <Txt faint size={Type.tiny}>{n.when}</Txt>
                </View>
                <Txt muted size={Type.small} style={{ lineHeight: 19 }}>{n.text}</Txt>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
