# لوحة الاتصال المؤسسي

موقع لمتابعة أعمال الإدارة التنفيذية، مبني بـ Node.js / Express / MongoDB / Socket.io / EJS.

## المميزات

- **صفحة المدير التنفيذي**: لوحة قيادة بنظرة شاملة (إجمالي الإيرادات، التصاميم، المنشورات، الزيارات) + رسوم بيانية تفصيلية + شريط إنجاز المهام.
- **صفحة الموظفين**: كل موظف يدخل بيانات قسمه فقط.
- **المهام الفردية**: إضافة، تحديد تاريخ النهاية، تأكيد الإتمام مع حفظ الوقت.
- **التحديث المباشر**: عبر Socket.io — أي إدخال جديد يظهر فوراً في لوحة المدير.
- **هوية بصرية**: ألوان مؤسسية (Navy/Off-White)، خط Tajawal، أيقونات Line، Progressive Disclosure.

## التشغيل

### 1. متطلبات
- Node.js 18+
- MongoDB يعمل محلياً (أو رابط Atlas)

### 2. الإعداد
```bash
npm install
cp .env.example .env
# عدّل .env إذا لزم (MONGODB_URI / SESSION_SECRET)
```

### 3. تعبئة المستخدمين الافتراضيين
```bash
npm run seed
```

سينشئ 5 مستخدمين، كلمة المرور لجميعهم: `123456`

| المستخدم | الدور | القسم |
|---|---|---|
| `executive` | مدير تنفيذي | — |
| `financial` | موظف | تنمية الموارد المالية |
| `media` | موظف | الإعلام |
| `content` | موظف | المحتوى المنشور |
| `followup` | موظف | المتابعة |

### 4. التشغيل
```bash
npm start
```
ثم افتح: http://localhost:3000

## رفع الصور على Render

Render يستخدم filesystem مؤقتاً افتراضياً، لذلك لا تعتمد على حفظ صور التصاميم داخل المشروع في الإنتاج. التطبيق يدعم تخزين الصور في خدمة S3-compatible مثل Cloudflare R2 أو AWS S3 عبر متغيرات البيئة:

```bash
S3_BUCKET=your-bucket
S3_REGION=auto
S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_PUBLIC_BASE_URL=https://your-public-domain
```

إذا لم تكن هذه المتغيرات موجودة، سيحفظ التطبيق الصور محلياً فقط لأغراض التطوير.

## الأقسام

| القسم | البيانات التي يدخلها |
|---|---|
| تنمية الموارد المالية | كبار الداعمين، منصة التبرعات، كشك التبرعات |
| الإعلام | عدد التصاميم |
| المحتوى المنشور | عدد المنشورات |
| المتابعة | زيارات (من/إلى الجمعية، الموقع) |

## بنية المشروع
```
├── server.js
├── models/         (User, Revenue, Design, Publication, Visit, Task)
├── routes/         (auth, dashboard, employee, tasks, api)
├── middleware/     (auth)
├── views/          (EJS — login, dashboard, employee, tasks)
├── public/
│   ├── css/style.css
│   └── js/         (dashboard.js, employee.js, tasks.js)
└── seed.js
```
