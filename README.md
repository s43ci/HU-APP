# BOOKLIT Ecosystem

منظومة لإنتاج المحتوى التعليمي وتوزيعه وإدارته.

| # | المكوّن | الدور |
|---|---------|-------|
| 01 | **BOOKLIT App** | تجربة الطالب: القراءة، المكتبة، أسئلة MCQ، التقدم، المشتريات |
| 02 | **BOOKLIT Studio** | إنتاج المحتوى: الكتابة، التصميم، الإخراج، إنتاج PDF، النشر — [الوثيقة](docs/booklit-studio.md) |
| 03 | **BOOKLIT Admin** | المستخدمون، إدارة المحتوى، المدفوعات، الصلاحيات، التحليلات |
| 04 | **BOOKLIT Backend** | قاعدة البيانات، المصادقة، التخزين، الـ APIs، المزامنة |

BOOKLIT ليس تطبيق ملازم فقط. هو منظومة تتكوّن من أداة لإنتاج المحتوى، ومنصة لتوزيعه، ونظام لإدارته وتشغيله.

## المستودع

| المجلد | المحتوى |
|--------|---------|
| [`booklit-app/`](booklit-app) | تطبيق الطالب (Expo / React Native) |
| [`docs/plan.md`](docs/plan.md) | خطة التنفيذ وما تم |
| [`docs/booklit-studio.md`](docs/booklit-studio.md) | وثيقة BOOKLIT Studio |

### تجربة التطبيق

افتح **Expo Go** على الهاتف وامسح هذا الرمز:

<img src="docs/expo-go-qr.png" width="220" />

أو شغّله محلياً: `cd booklit-app && npm install && npx expo start`
