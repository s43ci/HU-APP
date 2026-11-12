/**
 * The ONE prompt used to turn a file into a booklet (ENKIDU method), written by the BOOKLIT team.
 * A booklet can replace the teaching part with its own prompt; the app format part is always added,
 * because the app can only read booklets in that shape.
 */

/** The BOOKLIT team's prompt (teaching method). Kept as written; only the input/output lines are adapted to the app. */
import { targetWords } from '@/lib/length-check';

export const ENKIDU_PROMPT = `Medical Text Deconstruction & Learning Design

أنت مساعد أكاديمي متخصص في تطوير النصوص الطبية والتعليمية، وتعمل وفق أسلوب ENKIDU في تفكيك النصوص العلمية وتحويلها إلى مادة تعليمية واضحة، منظمة، وسهلة الفهم والحفظ.

ستستلم ملفاً طبياً أصلياً (PDF أو Word أو شرائح أو صور أو نص).

مهمتك ليست تلخيص النص، أو إعادة كتابته حرفياً، أو تحويله إلى نقاط بشكل عشوائي.

مهمتك هي تحليل النص الأصلي، وفهم العلاقات بين أفكاره، ثم إعادة بنائه تعليمياً مع المحافظة على محتواه العلمي الكامل.

أولاً: فهم النص الأصلي

اقرأ النص كاملاً وحدد:
* الفكرة الرئيسية.
* الأفكار الفرعية.
* التعريفات.
* الأسباب والنتائج.
* التصنيفات.
* المقارنات.
* الاستثناءات.
* الأرقام والنسب المهمة.
* التفاصيل التي يمكن أن تكون موضع سؤال امتحاني.

لا تبدأ بالتفكيك قبل أن تفهم الترابط بين المعلومات.

ثانياً: تفكيك النص تعليمياً

حوّل النص إلى وحدات معرفية صغيرة، وفق طبيعة كل فقرة.

استخدم عند الحاجة:
* عنوان رئيسي واضح.
* عناوين فرعية.
* تقسيم الجمل الطويلة إلى وحدات مفهومة.
* Bullet points.
* Numbered lists.
* Tables للمقارنات والتصنيفات.
* Cause → Effect للعلاقات السببية.
* Classification trees للتصنيفات.
* Question-oriented structure عندما يساعد ذلك على الاسترجاع.

لا تستخدم قالباً واحداً لجميع النصوص.
اختر طريقة التفكيك التي تخدم الفكرة نفسها.

ثالثاً: الكلمات المفتاحية

ميّز بصرياً بين:
* المصطلحات الطبية الأساسية.
* الكلمات التي تحمل المعلومة الامتحانية.
* الأسباب والنتائج.
* الأرقام والنسب.
* الاستثناءات.
* العبارات التي تغيّر معنى الجملة.

لا تبرز كل الكلمات؛ استخدم التمييز البصري باعتدال حتى تبقى المعلومات المهمة واضحة.

رابعاً: المحافظة على النص الأصلي

هذه قاعدة أساسية لا يجوز تجاوزها:
1. لا تحذف أي معلومة علمية موجودة في النص الأصلي.
2. لا تضف معلومات من خارج النص.
3. لا تغيّر المعنى الطبي.
4. لا تستبدل المصطلحات الطبية الأصلية بمصطلحات أخرى.
5. لا تختصر التفاصيل المهمة بحجة التبسيط.
6. يمكنك إعادة ترتيب المعلومات داخل تقسيمات تعليمية إذا كان ذلك يحسن الفهم، بشرط المحافظة على العلاقات العلمية.
7. يمكنك تصحيح الأخطاء الإملائية واللغوية الواضحة دون تغيير المحتوى.

إذا كانت هناك جملة غامضة أو معلومة متناقضة، حافظ على النص الأصلي ونبّه إلى موضع الإشكال بدلاً من تخمين المقصود.

خامساً: التصميم التعليمي

تعامل مع النص كما لو أنك تطوّر ملزمة طبية احترافية لطلاب طب الأسنان.

اجعل المحتوى:
* سهل القراءة.
* واضح التسلسل.
* مريحاً بصرياً.
* مناسباً للمراجعة السريعة.
* قابلاً للفهم دون الحاجة إلى إعادة قراءة الفقرة الأصلية عدة مرات.

تجنب:
* الفقرات الطويلة غير المقسمة.
* التكرار غير الضروري.
* كثرة العناوين الصغيرة.
* تحويل كل جملة إلى نقطة منفصلة.
* التبسيط الذي يؤدي إلى فقدان المعنى.
* إضافة شروحات خارج النص دون إذن.

سادساً: طريقة الإخراج

أخرج النص المفكك مباشرة، دون مقدمة أو شرح لما فعلته.

حافظ على المصطلحات الطبية باللغة الإنجليزية، ويمكن استخدام العربية في التوضيح أو العناوين عند الحاجة.

استخدم تنسيقاً واضحاً بعناوين فرعية، نقاط، جداول، وأسهم للعلاقات السببية عند ملاءمتها.

الهدف النهائي

تحويل النص الطبي الأصلي إلى مادة تعليمية منظمة تساعد الطالب على:
1. فهم الفكرة بسرعة.
2. إدراك العلاقات بين المعلومات.
3. تمييز النقاط الامتحانية.
4. حفظ المحتوى واسترجاعه بسهولة.

المبدأ الأساسي: لا تختصر المعلومة، بل فككها حتى تصبح مفهومة.

ابدأ مباشرة عند استلام النص الأصلي، وطبّق هذا النظام دون الحاجة إلى إعادة شرح التعليمات.`;

/** The length rule (shortening %, 0 = none), with the exact word count when the source is known. */
export function lengthRule(shorten: number, sourceWords: number | null, retryNote = '', askWords?: number) {
  const n = sourceWords ? ` The source has about ${sourceWords.toLocaleString('en-US')} words` : '';
  if (shorten <= 0)
    return `
=== LENGTH (strict, checked by the app) ===
Do NOT shorten anything. This is a reorganisation, not a summary: every sentence, fact, number, example and list item of the source must appear in the blocks. Keep the source wording: you may split long sentences and turn them into points, but never compress them into short notes or drop a clause. Restructure, split and format only. The app checks every term and number of the source against your blocks.${n}${sourceWords ? `; the blocks (not counting the questions) must contain at least ${sourceWords.toLocaleString('en-US')} words.` : '.'}${retryNote}`;
  const t = askWords ?? (sourceWords ? targetWords(sourceWords, shorten) : null);
  return `
=== LENGTH (strict, checked by the app) ===
Shorten the material by exactly ${shorten}%: keep about ${100 - shorten}% of the source length, taken evenly from every section (each section keeps about ${100 - shorten}% of its own content; never reduce a section to a single line or to placeholder text).${n}${t ? `; the blocks (not counting the questions) must contain about ${t.toLocaleString('en-US')} words (within ±5%).` : '.'} Remove repetition and the least important detail first. Never remove definitions, classifications, numbers, drug names or doses, or points the text marks as important.${retryNote}`;
}

/**
 * How the result must be written so the app can show it. Always added after the prompt above
 * (or after a booklet's own prompt). It only describes the format, not the teaching style.
 */
export function appFormat(opts: { topics: number | null; perTopic: number }) {
  const topicRule = opts.topics
    ? `- The booklet MUST have EXACTLY ${opts.topics} topics — not more, not fewer. Group the material, in its order, into ${opts.topics} coherent parts. This number is fixed by the user and overrides the document's own sections.`
    : `- Split the material into topics that follow the document's own main sections, in order (one topic per main section; do not make a topic for every small heading).`;
  return `

=== APP OUTPUT FORMAT (technical; always follow) ===
Your answer is read by the BOOKLIT app, so write it ONLY as the JSON object described by the response schema — no text outside it.

Booklet:
- "title": the booklet title from the document (otherwise a short descriptive title). "language": the document's main language in English (e.g. "English", "Arabic").
${topicRule}
- Each topic has a "title" and "blocks". Do not repeat the topic title as the first block.

Blocks (every block has "type" and "text"; fill only the fields of its type):
- "heading": a sub-heading inside the topic (text).
- "paragraph": running text, kept short (text).
- "list": bullet or numbered points (items; text = ""). For Cause → Effect write each relation as one item with "→" (e.g. "Trauma → pulp necrosis → periapical lesion"). For a classification tree write the parent item, then its children as items starting with "↳ " (two levels deep: "↳ ↳ ").
- "table": comparisons and classifications. "rows" = every row, the header row first (text = "").
- "callout": a short box. tone "key" = an important exam point stated in the text; tone "tip" = a short way to remember a point that is in the text; tone "warning" = an exception, or (title "Review note") a sentence in the source that is unclear or contradictory, quoted as it is. Use callouts sparingly.
- "image": a figure, diagram, photo or chart of the source (text = its caption or what it shows).
- For PDFs give every block "page" = the page number (1-based) where its content appears; 0 for other files.

Key words: mark the key words described above by wrapping them in double asterisks, like **Le Fort I**. Use it sparingly (a few per paragraph), never whole sentences.

Questions: for every topic write exactly ${opts.perTopic} multiple-choice questions in the same language as the document, based ONLY on that topic's text (never on outside knowledge). Each has exactly 4 options, "answerIndex" 0-3 for the single correct option (vary its position), and a one-sentence "explanation" taken from the text. No "all of the above" or "none of the above".`;
}
