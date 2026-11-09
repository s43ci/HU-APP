export type StageId = 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5';

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
  | { type: 'image'; caption: string; icon: string; /** Local image file (added in the editor). */ uri?: string };

export type Topic = {
  id: string;
  bookletId: string;
  title: string;
  order: number;
  minutes: number;
  blocks: ContentBlock[];
};

/** 'generated' = practice questions created by AI for uploaded files. */
export type McqSource = 'ministry' | 'instructor' | 'generated';

export type Mcq = {
  id: string;
  topicId: string;
  source: McqSource;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

/** A booklet built by AI from a file the student uploaded (PDF, Word, slides, image, text). */
export type ImportedBooklet = {
  id: string;
  title: string;
  fileName: string;
  language: string;
  createdAt: number;
  /** Subject the admin placed this booklet in (default: My Uploads). */
  subjectId?: string;
  topics: Topic[];
  mcqs: Mcq[];
};
