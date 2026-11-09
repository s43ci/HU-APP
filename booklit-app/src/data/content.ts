/**
 * Sample content used until the BOOKLIT backend is connected.
 * Hierarchy: Stage -> Subject -> Booklet -> Topic -> Content Blocks, MCQs linked by topicId.
 * Replace with API data in src/lib/api.ts (see docs/plan.md, phase 2).
 */
import { t } from '@/i18n';
import type { Booklet, ContentBlock, ImportedBooklet, Mcq, Stage, Subject, Topic } from './types';

export const stages: Stage[] = [
  { id: 'stage1', name: 'First Stage' },
  { id: 'stage2', name: 'Second Stage' },
  { id: 'stage3', name: 'Third Stage' },
  { id: 'stage4', name: 'Fourth Stage' },
  { id: 'stage5', name: 'Fifth Stage' },
];

export const subjects: Subject[] = [
  { id: 'oral-surgery', name: 'Oral Surgery', stageId: 'stage5', color: '#6D3BEA', icon: 'skull-outline', isFree: true, description: 'Maxillofacial trauma, TMJ, cleft and dentoalveolar surgery.' },
  { id: 'orthodontics', name: 'Orthodontics', stageId: 'stage5', color: '#2452DB', icon: 'tooth-outline', isFree: true, description: 'Growth, malocclusion, diagnosis and appliances.' },
  { id: 'oral-medicine', name: 'Oral Medicine', stageId: 'stage5', color: '#0E8F8F', icon: 'stethoscope', isFree: false, description: 'Mucosal lesions, systemic disease and oral diagnosis.' },
  { id: 'prosthodontics', name: 'Prosthodontics', stageId: 'stage5', color: '#B4568A', icon: 'crown-outline', isFree: false, description: 'Complete, partial and fixed prosthodontics.' },
  { id: 'endodontics', name: 'Endodontics', stageId: 'stage4', color: '#C2410C', icon: 'tooth', isFree: true, description: 'Pulp biology, diagnosis and root canal treatment.' },
  { id: 'periodontics', name: 'Periodontics', stageId: 'stage4', color: '#15803D', icon: 'water-outline', isFree: false, description: 'Periodontal disease, classification and therapy.' },
  { id: 'paediatric', name: 'Paediatric Dentistry', stageId: 'stage5', color: '#D97706', icon: 'emoticon-happy-outline', isFree: true, description: 'Child management, pulp therapy and space maintenance.' },
  { id: 'dental-anatomy', name: 'Dental Anatomy', stageId: 'stage1', color: '#493BEA', icon: 'tooth', isFree: true, description: 'Morphology of the permanent and primary dentition.' },
  { id: 'human-anatomy', name: 'Human Anatomy', stageId: 'stage1', color: '#493BEA', icon: 'bone', isFree: true, description: 'Head and neck anatomy for dental students.' },
  { id: 'medical-biology', name: 'Medical Biology', stageId: 'stage1', color: '#493BEA', icon: 'dna', isFree: false, description: 'Cell biology, genetics and tissues.' },
  { id: 'oral-histology', name: 'Oral Histology', stageId: 'stage2', color: '#493BEA', icon: 'microscope', isFree: true, description: 'Enamel, dentin, pulp, periodontium and oral mucosa.' },
  { id: 'dental-materials', name: 'Dental Materials', stageId: 'stage2', color: '#493BEA', icon: 'flask', isFree: false, description: 'Properties and handling of restorative and impression materials.' },
  { id: 'physiology', name: 'Physiology', stageId: 'stage2', color: '#493BEA', icon: 'heart', isFree: true, description: 'Body systems with a focus on the oral cavity.' },
  { id: 'oral-pathology', name: 'Oral Pathology', stageId: 'stage3', color: '#493BEA', icon: 'microscope', isFree: true, description: 'Cysts, tumours and lesions of the oral cavity.' },
  { id: 'pharmacology', name: 'Pharmacology', stageId: 'stage3', color: '#493BEA', icon: 'pill', isFree: true, description: 'Drugs used in dentistry: analgesics, antibiotics and local anaesthetics.' },
  { id: 'general-medicine', name: 'General Medicine', stageId: 'stage3', color: '#493BEA', icon: 'stethoscope', isFree: false, description: 'Systemic diseases relevant to dental practice.' },
  { id: 'dental-trauma', name: 'Dental Trauma', stageId: 'stage4', color: '#4F46E5', icon: 'flash-outline', isFree: false, description: 'Classification and management of dental injuries.' },
];

const bookletTitles: Record<string, string[]> = {
  'oral-surgery': ['Midface Fractures', 'TMJ Disorders', 'Cleft Lip & Palate', 'Dentoalveolar Surgery', 'Impacted Teeth'],
  orthodontics: ['Growth & Development', 'Class II Malocclusion', 'Class III Malocclusion', 'Removable Appliances'],
  'oral-medicine': ['White Lesions', 'Vesiculobullous Diseases', 'Oral Ulcers'],
  prosthodontics: ['Complete Dentures', 'Removable Partial Dentures', 'Fixed Prosthodontics'],
  endodontics: ['Pulpal Diagnosis', 'Access Cavity', 'Irrigation & Obturation'],
  periodontics: ['Classification 2017', 'Non-surgical Therapy', 'Periodontal Surgery'],
  paediatric: ['Behaviour Management', 'Pulp Therapy in Primary Teeth', 'Space Maintainers'],
  'dental-trauma': ['Crown Fractures', 'Luxation Injuries', 'Avulsion'],
  'dental-anatomy': ['Tooth Numbering Systems', 'Permanent Incisors', 'Permanent Canines', 'Premolars', 'Permanent Molars', 'Primary Dentition'],
  'human-anatomy': ['Skull & Mandible', 'Muscles of Mastication', 'Cranial Nerves V & VII', 'Blood Supply of the Face'],
  'medical-biology': ['The Cell', 'Cell Division', 'Basic Genetics'],
  'oral-histology': ['Enamel', 'Dentin', 'Dental Pulp', 'Periodontal Ligament', 'Oral Mucosa'],
  'dental-materials': ['Impression Materials', 'Gypsum Products', 'Dental Amalgam', 'Composite Resins'],
  physiology: ['Blood', 'Nerve & Muscle', 'Saliva', 'Taste & Mastication'],
  'oral-pathology': ['Odontogenic Cysts', 'Odontogenic Tumours', 'Salivary Gland Diseases', 'Potentially Malignant Disorders'],
  pharmacology: ['Local Anaesthetics', 'Analgesics', 'Antibiotics in Dentistry'],
  'general-medicine': ['Cardiovascular Disease', 'Diabetes Mellitus', 'Bleeding Disorders'],
};

const topicTitles: Record<string, string[]> = {
  'Midface Fractures': ['Le Fort Fractures', 'Zygomatic Complex Fractures', 'Nasal Fractures', 'Orbital Fractures', 'Maxillary Fractures', 'Fronto-Orbital Fractures', 'Management Principles', 'Complications'],
  'TMJ Disorders': ['TMJ Anatomy', 'Internal Derangement', 'TMJ Dislocation', 'Ankylosis', 'Myofascial Pain'],
  'Cleft Lip & Palate': ['Embryology', 'Classification', 'Feeding & Early Care', 'Surgical Timing'],
  'Dentoalveolar Surgery': ['Principles of Flap Design', 'Surgical Extraction', 'Suturing Techniques'],
  'Impacted Teeth': ['Mandibular Third Molar', 'Winter’s Lines', 'Impacted Canine'],
  'Class II Malocclusion': ['Aetiology', 'Division 1 Features', 'Functional Appliances'],
  'Pulpal Diagnosis': ['Reversible Pulpitis', 'Irreversible Pulpitis', 'Pulp Necrosis', 'Sensibility Tests'],
  'Permanent Incisors': ['Maxillary Central Incisor', 'Maxillary Lateral Incisor', 'Mandibular Incisors'],
  Enamel: ['Physical Characteristics', 'Enamel Rods', 'Incremental Lines', 'Amelogenesis'],
  'Impression Materials': ['Classification', 'Alginate', 'Elastomers'],
};

export const booklets: Booklet[] = Object.entries(bookletTitles).flatMap(([subjectId, titles]) =>
  titles.map((title, i) => ({ id: `${subjectId}--${slug(title)}`, subjectId, title, order: i + 1 })),
);

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Hand-written topics (fuller sample content). */
const written: Record<string, ContentBlock[]> = {
  'Le Fort Fractures': [
    { type: 'paragraph', text: 'Le Fort fractures are transverse fractures of the midface that separate part or all of the maxilla from the skull base. René Le Fort described three classic patterns in 1901 after applying blunt force to cadaver skulls.' },
    { type: 'heading', text: 'Classification' },
    { type: 'table', headers: ['Type', 'Fracture line', 'Mobile segment'], rows: [
      ['Le Fort I', 'Horizontal, above the apices, through the nasal floor and lower pterygoid plates', 'Tooth-bearing maxilla (floating palate)'],
      ['Le Fort II', 'Pyramidal: nasal bones → frontal process → infraorbital rim → zygomaticomaxillary suture → pterygoid plates', 'Maxilla + nasal complex (pyramidal)'],
      ['Le Fort III', 'Craniofacial dysjunction through frontozygomatic suture, orbits and nasofrontal suture', 'Entire midface separated from cranium'],
    ] },
    { type: 'image', caption: 'Fracture lines of Le Fort I, II and III (frontal view)', icon: 'skull-scan-outline' },
    { type: 'heading', text: 'Clinical features' },
    { type: 'list', items: [
      'Anterior open bite with premature posterior contact (gagging of occlusion)',
      'Mobility of the maxilla on bimanual examination',
      '“Dish face” deformity and lengthening of the face in II and III',
      'Bilateral circumorbital ecchymosis (“panda / raccoon eyes”) in II and III',
      'CSF rhinorrhoea possible in Le Fort II and III',
      'Guérin’s sign: ecchymosis at the greater palatine vessels in Le Fort I',
    ] },
    { type: 'callout', tone: 'key', title: 'Key point', text: 'Le Fort I is the only type that does not involve the orbit. Any orbital signs point to Le Fort II or III.' },
    { type: 'heading', text: 'Investigations' },
    { type: 'paragraph', text: 'CT scan with axial and coronal cuts plus 3D reconstruction is the investigation of choice. Occipitomental views (15° and 30°) are useful plain films when CT is not available.' },
    { type: 'callout', tone: 'warning', title: 'Airway first', text: 'A posteriorly displaced maxilla can obstruct the airway. Disimpact the maxilla forwards with the fingers behind the soft palate as part of emergency management.' },
  ],
  'Zygomatic Complex Fractures': [
    { type: 'paragraph', text: 'The zygoma forms the prominence of the cheek and articulates with the frontal, temporal, sphenoid and maxillary bones. Fractures usually separate it at these sutures, so the injury is called a zygomatic complex (ZMC) or “tripod” fracture.' },
    { type: 'heading', text: 'Signs and symptoms' },
    { type: 'list', items: [
      'Flattening of the cheek prominence (best seen from above)',
      'Infraorbital nerve paraesthesia (cheek, side of nose, upper lip)',
      'Step deformity at the infraorbital rim or frontozygomatic suture',
      'Subconjunctival haemorrhage with no posterior limit',
      'Limited mouth opening when the coronoid process is impinged',
      'Diplopia and enophthalmos when the orbital floor is involved',
    ] },
    { type: 'image', caption: 'Four articulations of the zygomatic complex', icon: 'face-man-outline' },
    { type: 'heading', text: 'Management' },
    { type: 'paragraph', text: 'Undisplaced fractures are treated conservatively. Displaced fractures are reduced by the Gillies temporal approach or an intraoral (Keen) approach, then fixed with miniplates at the frontozygomatic suture, the infraorbital rim and the zygomatic buttress as needed.' },
    { type: 'callout', tone: 'tip', title: 'Exam tip', text: 'Gillies approach: the elevator passes deep to the temporalis fascia, superficial to the temporalis muscle.' },
  ],
  'Nasal Fractures': [
    { type: 'paragraph', text: 'The nasal bones are the most frequently fractured facial bones because of their prominence and thin structure.' },
    { type: 'list', items: ['Deviation or depression of the nasal dorsum', 'Epistaxis and swelling', 'Septal haematoma, which must be drained urgently', 'Crepitus on palpation'] },
    { type: 'callout', tone: 'warning', title: 'Septal haematoma', text: 'If it is not drained it may cause septal cartilage necrosis and a saddle-nose deformity.' },
    { type: 'paragraph', text: 'Closed reduction is ideally carried out immediately or after the swelling settles, at 5–10 days.' },
  ],
  'Orbital Fractures': [
    { type: 'paragraph', text: 'A pure “blow-out” fracture of the orbital floor happens when the intraorbital pressure rises suddenly and the thin floor gives way while the rim stays intact.' },
    { type: 'list', items: ['Diplopia on upward gaze (inferior rectus entrapment)', 'Enophthalmos', 'Infraorbital paraesthesia', '“Tear-drop” sign on coronal CT'] },
    { type: 'callout', tone: 'warning', title: 'Emergency', text: 'Trapdoor fractures in children with muscle entrapment and the oculocardiac reflex need surgery immediately.' },
  ],
  'Management Principles': [
    { type: 'paragraph', text: 'Management of midface fractures follows ATLS priorities, then definitive reduction and fixation once the patient is stable.' },
    { type: 'list', items: ['A: airway with cervical spine control', 'B: breathing', 'C: circulation and haemorrhage control', 'D: disability (neurological status)', 'E: exposure'] },
    { type: 'heading', text: 'Definitive treatment' },
    { type: 'list', items: ['Re-establish pre-injury occlusion with IMF', 'Open reduction and internal fixation along the vertical buttresses', 'Restore facial height, width and projection'] },
    { type: 'callout', tone: 'key', title: 'Buttresses', text: 'Vertical: nasomaxillary, zygomaticomaxillary, pterygomaxillary. These are the main targets for plate fixation.' },
  ],
  'Complications': [
    { type: 'list', items: ['Malocclusion and malunion', 'Infraorbital nerve dysfunction', 'Enophthalmos and diplopia', 'Nasolacrimal duct obstruction (epiphora)', 'CSF leak and meningitis', 'Airway compromise in the acute phase'] },
    { type: 'callout', tone: 'tip', title: 'Remember', text: 'Persistent CSF rhinorrhoea beyond 7–10 days needs neurosurgical referral.' },
  ],
  'Reversible Pulpitis': [
    { type: 'paragraph', text: 'Reversible pulpitis is mild inflammation that resolves once the irritant is removed.' },
    { type: 'list', items: ['Sharp pain to cold that subsides within seconds', 'No spontaneous pain', 'Normal periapical radiograph'] },
    { type: 'callout', tone: 'key', title: 'Treatment', text: 'Remove the cause (caries or a leaking restoration) and place a sedative or definitive restoration.' },
  ],
  'Irreversible Pulpitis': [
    { type: 'paragraph', text: 'In irreversible pulpitis the pulp cannot heal and needs endodontic treatment.' },
    { type: 'list', items: ['Lingering pain after thermal stimulus', 'Spontaneous, nocturnal pain', 'Pain that may be referred'] },
    { type: 'callout', tone: 'key', title: 'Treatment', text: 'Pulpectomy and root canal treatment, or pulpotomy in selected cases.' },
  ],
};

function genericBlocks(title: string, subjectName: string): ContentBlock[] {
  return [
    { type: 'paragraph', text: `${title} is a core topic in ${subjectName}. This section gives the definition, the key classification, the clinical features and the management principles you need for exams and clinics.` },
    { type: 'heading', text: 'Definition' },
    { type: 'paragraph', text: `A clear definition of ${title.toLowerCase()} and where it sits within ${subjectName}.` },
    { type: 'heading', text: 'Key points' },
    { type: 'list', items: ['Aetiology and predisposing factors', 'Clinical presentation', 'Diagnosis and investigations', 'Treatment options and prognosis'] },
    { type: 'callout', tone: 'tip', title: 'Exam tip', text: 'Ministry questions on this topic usually test the classification and the first-line treatment.' },
  ];
}

export const topics: Topic[] = booklets.flatMap((b) => {
  const subject = subjects.find((s) => s.id === b.subjectId)!;
  const titles = topicTitles[b.title] ?? ['Introduction', 'Classification', 'Clinical Features', 'Management'];
  return titles.map((title, i) => {
    const blocks = written[title] ?? genericBlocks(title, subject.name);
    const words = blocks.reduce((n, bl) => n + JSON.stringify(bl).split(' ').length, 0);
    return { id: `${b.id}--${slug(title)}`, bookletId: b.id, title, order: i + 1, minutes: Math.max(2, Math.round(words / 180)), blocks };
  });
});

const writtenMcqs: Record<string, Omit<Mcq, 'id' | 'topicId'>[]> = {
  'Le Fort Fractures': [
    { source: 'ministry', question: 'Which Le Fort fracture does NOT involve the orbit?', options: ['Le Fort I', 'Le Fort II', 'Le Fort III', 'None of them'], answerIndex: 0, explanation: 'Le Fort I runs horizontally above the tooth apices and does not reach the orbit.' },
    { source: 'ministry', question: 'Guérin’s sign is associated with:', options: ['Zygomatic fracture', 'Le Fort I fracture', 'Nasal fracture', 'Orbital blow-out'], answerIndex: 1, explanation: 'Ecchymosis in the region of the greater palatine vessels is Guérin’s sign of a Le Fort I fracture.' },
    { source: 'ministry', question: 'The investigation of choice for Le Fort fractures is:', options: ['OPG', 'Occipitomental view', 'CT with 3D reconstruction', 'MRI'], answerIndex: 2, explanation: 'CT (axial and coronal) with 3D reconstruction shows all fracture lines.' },
    { source: 'instructor', question: 'Anterior open bite after midface trauma is caused by:', options: ['Forward displacement of the maxilla', 'Downward and backward displacement of the maxilla', 'Mandibular condyle dislocation only', 'Nasal bone fracture'], answerIndex: 1, explanation: 'The pterygoid muscles pull the maxilla down and back, so the posterior teeth meet first and the anterior bite opens.' },
    { source: 'instructor', question: 'CSF rhinorrhoea is most expected with:', options: ['Le Fort I', 'Le Fort II and III', 'Isolated nasal fracture', 'Dentoalveolar fracture'], answerIndex: 1, explanation: 'Le Fort II and III may involve the cribriform plate and cause a CSF leak.' },
  ],
  'Zygomatic Complex Fractures': [
    { source: 'ministry', question: 'In the Gillies approach the elevator is placed:', options: ['Superficial to temporalis fascia', 'Deep to temporalis fascia, superficial to temporalis muscle', 'Deep to temporalis muscle', 'Through the buccal sulcus'], answerIndex: 1, explanation: 'The elevator slides beneath the deep temporal fascia over the muscle to reach the deep surface of the zygoma.' },
    { source: 'instructor', question: 'Limited mouth opening in a ZMC fracture is due to:', options: ['Masseter spasm only', 'Impingement on the coronoid process', 'TMJ dislocation', 'Infraorbital nerve injury'], answerIndex: 1, explanation: 'A depressed zygomatic arch may impinge on the coronoid process.' },
  ],
  'Orbital Fractures': [
    { source: 'ministry', question: 'The “tear-drop sign” on CT indicates:', options: ['Nasal fracture', 'Orbital floor blow-out with herniated contents', 'Le Fort I', 'Frontal sinus fracture'], answerIndex: 1, explanation: 'Herniated orbital contents into the maxillary sinus form a tear-drop shape.' },
  ],
  'Irreversible Pulpitis': [
    { source: 'ministry', question: 'Lingering pain after a cold stimulus indicates:', options: ['Reversible pulpitis', 'Irreversible pulpitis', 'Pulp necrosis', 'Normal pulp'], answerIndex: 1, explanation: 'Pain that lingers after the stimulus is removed is the hallmark of irreversible pulpitis.' },
  ],
};

export const mcqs: Mcq[] = topics.flatMap((t) => {
  const list = writtenMcqs[t.title] ?? [
    { source: 'ministry' as const, question: `Which statement about ${t.title.toLowerCase()} is most accurate?`, options: ['Diagnosis relies on history and examination', 'It never requires treatment', 'It only affects primary teeth', 'Radiographs are contraindicated'], answerIndex: 0, explanation: 'Diagnosis starts with a careful history and clinical examination, supported by investigations.' },
    { source: 'instructor' as const, question: `The first step in managing ${t.title.toLowerCase()} is:`, options: ['Definitive surgery', 'Correct diagnosis and assessment', 'Antibiotics for all cases', 'Referral without examination'], answerIndex: 1, explanation: 'Management always begins with correct diagnosis and assessment.' },
  ];
  return list.map((q, i) => ({ ...q, id: `${t.id}--q${i + 1}`, topicId: t.id }));
});

/** Virtual subject that holds the student's uploaded files. */
export const UPLOADS_SUBJECT: Subject = {
  id: 'uploads',
  name: 'My Files',
  stageId: 'stage5',
  color: '#493BEA',
  icon: 'file',
  isFree: true,
  description: 'Booklets made from your own files.',
};
subjects.push(UPLOADS_SUBJECT);

/** Course subjects only (excludes "My Uploads"). */
export const courseSubjects = () => subjects.filter((s) => s.id !== UPLOADS_SUBJECT.id);

let importedIds = new Set<string>();
let extraIds = new Set<string>();
/**
 * Merge Studio content into the shared arrays (called by the store):
 * uploaded/created booklets (placed in their chosen subject) and MCQs imported from question banks.
 */
export function setImportedContent(list: ImportedBooklet[], extra: Mcq[] = []) {
  for (let i = booklets.length - 1; i >= 0; i--) if (importedIds.has(booklets[i].id)) booklets.splice(i, 1);
  for (let i = topics.length - 1; i >= 0; i--) if (importedIds.has(topics[i].bookletId)) topics.splice(i, 1);
  for (let i = mcqs.length - 1; i >= 0; i--) {
    const q = mcqs[i];
    if (extraIds.has(q.id) || [...importedIds].some((b) => q.topicId.startsWith(`${b}--`))) mcqs.splice(i, 1);
  }

  importedIds = new Set(list.map((b) => b.id));
  extraIds = new Set(extra.map((q) => q.id));
  list.forEach((b) => {
    const subjectId = b.subjectId && subjects.some((s) => s.id === b.subjectId) ? b.subjectId : UPLOADS_SUBJECT.id;
    const order = booklets.filter((x) => x.subjectId === subjectId).length + 1;
    booklets.push({ id: b.id, subjectId, title: b.title, order });
    topics.push(...b.topics);
    mcqs.push(...b.mcqs);
  });
  mcqs.push(...extra);
}

/** True for booklets made in BOOKLIT Studio (uploaded or created), which can be edited. */
export const isStudioBooklet = (bookletId: string) => importedIds.has(bookletId);

// ---------- selectors ----------
export const getSubject = (id: string) => subjects.find((s) => s.id === id);
export const getBooklet = (id: string) => booklets.find((b) => b.id === id);
export const getTopic = (id: string) => topics.find((t) => t.id === id);
export const bookletsOf = (subjectId: string) => booklets.filter((b) => b.subjectId === subjectId);
export const topicsOf = (bookletId: string) => topics.filter((t) => t.bookletId === bookletId);
export const topicsOfSubject = (subjectId: string) => bookletsOf(subjectId).flatMap((b) => topicsOf(b.id));
export const mcqsOf = (topicId: string, source?: Mcq['source']) =>
  mcqs.filter((q) => q.topicId === topicId && (!source || q.source === source));
export const subjectOfTopic = (topicId: string) => {
  const t = getTopic(topicId);
  const b = t && getBooklet(t.bookletId);
  return b && getSubject(b.subjectId);
};
export const stageName = (id: string) => t(stages.find((s) => s.id === id)?.name ?? '');

export function topicPlainText(t: Topic): string {
  return t.blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':
        case 'paragraph':
          return b.text;
        case 'list':
          return b.items.map((i) => `- ${i}`).join('\n');
        case 'table':
          return [b.headers.join(' | '), ...b.rows.map((r) => r.join(' | '))].join('\n');
        case 'callout':
          return `${b.title}: ${b.text}`;
        case 'image':
          return `[Figure: ${b.caption}]`;
      }
    })
    .join('\n\n');
}
