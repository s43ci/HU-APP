# خطة تنفيذ BOOKLIT App: أسبوع واحد

المرجع: `BOOKLIT_UI_Design_Developer_Guide.docx`، والتصاميم المرسلة، ووثيقة [BOOKLIT Studio](booklit-studio.md).

## التقنية

| الجزء | الاختيار | السبب |
|------|----------|-------|
| التطبيق | Expo (React Native) + Expo Router + TypeScript | تطبيق واحد لـ iOS وAndroid، ويُجرَّب فوراً على Expo Go |
| الخط | Plus Jakarta Sans | من هوية BOOKLIT |
| الأيقونات | Material Community Icons (Line) | عائلة موحدة وخفيفة |
| الذكاء الاصطناعي | Gemini `gemini-3.5-flash-lite` (نموذج رخيص) عبر `src/app/api/ask+api.ts` على EAS Hosting | المفتاح متغير `GEMINI_API_KEY` على Expo، ولا يدخل التطبيق |
| الخادم (المرحلة 2) | Supabase: Postgres + Auth + Storage + RLS | حماية المحتوى المدفوع من الخادم، ولوحة إدارة سريعة |

## ما تم (اليوم 1–2): واجهة التطبيق كاملة

- [x] **الرأس الثابت (Header):** تدرّج أزرق/بنفسجي، شعار Booklit، إشعارات مع نقطة، بحث، وتبديل الوضع الليلي.
- [x] **شريط التنقل الثابت:** كبسولة بيضاء، والقسم النشط بنفسجي على خلفية Lavender (Home, Library, Progress, Favorites, Profile).
- [x] **Home:** ترحيب باسم الطالب، بحث، بطاقة Continue Reading ترجع لآخر موضع قراءة، اختصارات المراحل، وقائمة Continue Studying.
- [x] **Library:** فلترة حسب المرحلة والنوع (مجاني/مدفوع)، بطاقات المواد، قفل صغير، ونافذة «هذه المادة مقفلة» مع زر تيليجرام وزر إغلاق.
- [x] **صفحة المادة:** الملازم والمواضيع. عمودان على الشاشات العريضة، وملازم ثم مواضيع على الهاتف. الملزمة النشطة مميزة.
- [x] **القارئ:** الجزء العلوي يختفي أثناء القراءة، شريط سفلي صغير، حفظ آخر موضع، Topic مستقل مع تنقل سابق/تالي، وجداول وصور وصناديق تعليمية.
- [x] **أزرار أسفل الموضوع:** Ministry MCQs و Instructor MCQs و Quiz Mode و **Ask AI** و Edit و Coming Soon.
- [x] **Edit:** المحتويات، البحث داخل الموضوع، حجم النص، الإشارة المرجعية، التظليل، وتعليم الموضوع كمكتمل.
- [x] **MCQs:** كل سؤال مرتبط بـ Topic. وضع تدريب مع شرح فوري، و Quiz Mode مع نتيجة ومراجعة الإجابات.
- [x] **Ask AI:** محادثة عن المادة والموضوع المفتوح أمام الطالب، بالعربي أو الإنجليزي.
- [x] **Progress:** نسبة إجمالية حقيقية، وتقدم كل مادة، وتفاصيل كل ملزمة.
- [x] **Favorites:** Booklets و Topics، إزالة، ورسالة فارغة.
- [x] **Profile:** بطاقة الطالب والإحصائيات (الملازم، الدقة، وقت الدراسة) والإعدادات كلها، و Log Out.
- [x] **الوضع الليلي**، وحفظ كل شيء على الجهاز.

## المتبقي من الأسبوع

### اليوم 3: الخادم (Supabase)
- [ ] الجداول: `stages, subjects, booklets, topics, content_blocks, mcqs, profiles, entitlements, progress, favorites`.
- [ ] Auth (بريد + كلمة مرور) بدل التسجيل المحلي.
- [ ] RLS: محتوى المواد المدفوعة (`content_blocks`, `mcqs`) لا يُرسل إلا لمن عنده `entitlement`. هذا تنفيذ للتنبيه الأمني في الدليل.
- [ ] ربط `src/data/content.ts` بالـ API، مع كاش محلي للقراءة بدون إنترنت.

### اليوم 4: لوحة الإدارة (BOOKLIT Admin)
- [ ] إضافة/تعديل/حذف المراحل والمواد والملازم والمواضيع والأسئلة.
- [ ] البحث عن طالب وتفعيل اشتراكه أو إلغاؤه بعد تأكيد الدفع.

### اليوم 5: الذكاء الاصطناعي والمحتوى
- [x] نشر خادم Ask AI على `https://booklit.expo.app/api/ask` (Gemini flash-lite).
- [ ] تحديد عدد أسئلة الـ AI لكل طالب يومياً، ومنع الوصول للمواد المقفلة.
- [ ] رفع المحتوى الحقيقي للملازم (بدل المحتوى التجريبي).

### اليوم 6–7: الاختبار والنشر
- [x] نشر نسخة تجريبية على Expo (قناة `preview`) للتجربة بـ Expo Go.
- [ ] اختبار على iPhone و Android، ثم Development Build.
- [ ] `eas build` و TestFlight / Google Play Internal Testing.
- [ ] تحديثات OTA عبر `eas update`.

## التشغيل محلياً

```bash
cd booklit-app
npm install
npx expo start        # امسح الـ QR بتطبيق Expo Go
```

## النشر

```bash
cd booklit-app
npx expo export --platform web && eas deploy --prod --environment production   # خادم Ask AI
eas update --channel preview --environment production -m "وصف التحديث"          # تحديث التطبيق على Expo Go
```

التجربة: افتح Expo Go وامسح [`docs/expo-go-qr.png`](expo-go-qr.png)، أو افتح الرابط
`exp://u.expo.dev/21780752-ca27-448a-bc5e-c10eaa1da81e?channel-name=preview`
