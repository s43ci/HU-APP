/**
 * Subject artwork generated with Gemini (prompts in docs/image-prompts.md).
 * Files live in assets/subjects/<id>.jpg (768×768). Subjects without an image
 * fall back to a thin-line icon tile.
 */
export const subjectImages: Partial<Record<string, number>> = {
  'oral-surgery': require('@/assets/subjects/oral-surgery.jpg'),
  orthodontics: require('@/assets/subjects/orthodontics.jpg'),
  'oral-medicine': require('@/assets/subjects/oral-medicine.jpg'),
  prosthodontics: require('@/assets/subjects/prosthodontics.jpg'),
  endodontics: require('@/assets/subjects/endodontics.jpg'),
  periodontics: require('@/assets/subjects/periodontics.jpg'),
  paediatric: require('@/assets/subjects/paediatric.jpg'),
  'dental-trauma': require('@/assets/subjects/dental-trauma.jpg'),
  'dental-anatomy': require('@/assets/subjects/dental-anatomy.jpg'),
  'human-anatomy': require('@/assets/subjects/human-anatomy.jpg'),
  'medical-biology': require('@/assets/subjects/medical-biology.jpg'),
  'oral-histology': require('@/assets/subjects/oral-histology.jpg'),
  'dental-materials': require('@/assets/subjects/dental-materials.jpg'),
  physiology: require('@/assets/subjects/physiology.jpg'),
  'oral-pathology': require('@/assets/subjects/oral-pathology.jpg'),
  pharmacology: require('@/assets/subjects/pharmacology.jpg'),
  'general-medicine': require('@/assets/subjects/general-medicine.jpg'),
  uploads: require('@/assets/subjects/uploads.jpg'),
};
