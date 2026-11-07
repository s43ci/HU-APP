import {
  Baby,
  Bone,
  BookOpen,
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
};

export function subjectVisual(subjectId: string): { icon: LucideIcon; image?: number } {
  return { icon: ICONS[subjectId] ?? BookOpen, image: subjectImages[subjectId] };
}
