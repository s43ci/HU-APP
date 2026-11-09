import {
  Baby,
  Bone,
  BookOpen,
  Dna,
  FlaskConical,
  HeartPulse,
  Pill,
  Braces,
  Crown,
  Droplet,
  FileText,
  Microscope,
  Skull,
  Stethoscope,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';

import { subjectImages } from '@/data/subject-images';

const ICONS: Record<string, LucideIcon> = {
  'oral-surgery': Skull,
  orthodontics: Braces,
  'oral-medicine': Stethoscope,
  prosthodontics: Crown,
  endodontics: Microscope,
  periodontics: Droplet,
  paediatric: Baby,
  'dental-trauma': Zap,
  uploads: FileText,
  'oral-pathology': Bone,
  'dental-anatomy': Crown,
  'human-anatomy': Bone,
  'medical-biology': Dna,
  'oral-histology': Microscope,
  'dental-materials': FlaskConical,
  physiology: HeartPulse,
  pharmacology: Pill,
  'general-medicine': Stethoscope,
};

export function subjectVisual(subjectId: string): { icon: LucideIcon; image?: number } {
  return { icon: ICONS[subjectId] ?? BookOpen, image: subjectImages[subjectId] };
}
