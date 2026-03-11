export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl p-6 leading-8" dir="rtl">
      <h1 className="mb-6 text-2xl font-bold">اتصل بنا</h1>

      <p>
        إذا كان لديك أي استفسار أو تحتاج إلى دعم تقني، يمكنك التواصل معنا عبر
        الوسائل التالية.
      </p>

      <div className="mt-6 space-y-3">
        <div>
          <strong>البريد الإلكتروني:</strong>
          <br />
          support@elyaia.com
        </div>

        <div>
          <strong>الهاتف:</strong>
          <br />
          +966XXXXXXXXX
        </div>

        <div>
          <strong>العنوان:</strong>
          <br />
          المملكة العربية السعودية
        </div>
      </div>

      <p className="mt-6">سنقوم بالرد على جميع الرسائل في أقرب وقت ممكن.</p>
    </div>
  );
}
