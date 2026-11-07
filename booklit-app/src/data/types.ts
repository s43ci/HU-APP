export type StageId = 'stage4' | 'stage5';

export type Stage = { id: StageId; name: string };

export type Subject = {
  id: string;
  name: string;
  stageId: StageId;
  /** Per-subject accent from the design system (e.g. Oral Surgery = purple). */
  color: string;
  icon: string; // MaterialCommunityIcons name
  isFree: boolean;
  description: string;
};

export type Booklet = {
  id: string;
  subjectId: string;
  title: string;
  order: number;
};

export type ContentBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'callout'; tone: 'key' | 'warning' | 'tip'; title: string; text: string }
  | { type: 'image'; caption: string; icon: string };

export type Topic = {
  id: string;
  bookletId: string;
  title: string;
  order: number;
  minutes: number;
  blocks: ContentBlock[];
};

export type McqSource = 'ministry' | 'instructor';

export type Mcq = {
  id: string;
  topicId: string;
  source: McqSource;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};
