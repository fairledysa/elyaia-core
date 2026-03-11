// FILE: src/app/(dashboard)/dashboard/guide/page.tsx

import {
  BookOpen,
  Boxes,
  ClipboardList,
  Factory,
  Layers3,
  Package,
  Printer,
  ShoppingBag,
  Users,
  Wallet,
  ShieldCheck,
  BarChart3,
  ArrowRightLeft,
} from "lucide-react";

type SectionCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
};

function SectionCard({ title, description, children, icon }: SectionCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 text-sm leading-7 text-slate-700">
        {children}
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-xl bg-slate-50 px-4 py-3 text-slate-700">
      {children}
    </li>
  );
}

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-slate-50" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-l from-slate-900 to-slate-700 p-6 text-white shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <BookOpen className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-extrabold sm:text-3xl">
                دليل النظام
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                هذا الدليل يشرح المشروع من البداية إلى النهاية: فكرة النظام،
                ترتيب الأولويات، شرح كل قسم، ومسار العمل اليومي من مزامنة
                الطلبات حتى التقارير النهائية.
              </p>
            </div>
          </div>
        </div>

        <SectionCard
          title="نظرة عامة على المشروع"
          description="فكرة النظام والهدف النهائي"
          icon={<Factory className="h-5 w-5" />}
        >
          <p>
            المشروع هو نظام تشغيل وإدارة مصنع أو ورشة إنتاج مربوط مع سلة، بحيث
            يستقبل الطلبات من المتجر ثم يحولها إلى أوامر تشغيل داخلية تمر على
            مراحل الإنتاج، ويحسب أداء العاملين، ويربط الاستهلاك بالمخزون، ويطبع
            أوراق التشغيل والباركود، ثم يخرج تقارير مالية وتشغيلية وإدارية.
          </p>

          <p>
            الهدف النهائي من النظام ليس فقط عرض الطلبات، بل بناء دورة تشغيل
            كاملة تشمل: المنتجات، المراحل، العاملين، الطباعة، المخزون، الجودة،
            التقييم، المستحقات، والتقارير.
          </p>
        </SectionCard>

        <SectionCard
          title="الأولوية الصحيحة للعمل على المشروع"
          description="الترتيب الأفضل للتنفيذ حتى لا يتخربط النظام"
          icon={<Layers3 className="h-5 w-5" />}
        >
          <ol className="space-y-3">
            <Bullet>
              <strong>أولًا:</strong> ضبط المنتجات والمراحل وربط المنتج بالمراحل
              وتسعير كل مرحلة.
            </Bullet>
            <Bullet>
              <strong>ثانيًا:</strong> مزامنة الطلبات من سلة وتحويلها إلى عناصر
              إنتاج وضبط الطباعة والباركود.
            </Bullet>
            <Bullet>
              <strong>ثالثًا:</strong> ضبط العاملين، تسجيل الإنجاز، واحتساب
              المستحقات.
            </Bullet>
            <Bullet>
              <strong>رابعًا:</strong> ضبط المخزون، حركة المخزون، وربط المواد
              بالموديلات.
            </Bullet>
            <Bullet>
              <strong>خامسًا:</strong> الجودة، التنبيهات، الأداء، والتقييم.
            </Bullet>
            <Bullet>
              <strong>سادسًا:</strong> المالية، المحفظة، والتقارير النهائية.
            </Bullet>
          </ol>
        </SectionCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title="الربط مع سلة"
            description="مدخل الطلبات والمنتجات من المتجر"
            icon={<ShoppingBag className="h-5 w-5" />}
          >
            <ul className="space-y-3">
              <Bullet>ربط المتجر بالنظام.</Bullet>
              <Bullet>مزامنة المنتجات من سلة.</Bullet>
              <Bullet>مزامنة الطلبات وبيانات العميل والـ SKU.</Bullet>
              <Bullet>
                التأكد من أن كل منتج مرتبط داخليًا قبل بدء التشغيل.
              </Bullet>
            </ul>
          </SectionCard>

          <SectionCard
            title="المنتجات"
            description="تعريف المنتجات وربطها بالتشغيل"
            icon={<Package className="h-5 w-5" />}
          >
            <ul className="space-y-3">
              <Bullet>عرض المنتجات القادمة من سلة.</Bullet>
              <Bullet>ربط كل منتج بالمراحل المطلوبة له.</Bullet>
              <Bullet>ربط المنتج بالمواد والخامات.</Bullet>
              <Bullet>تحديد تكلفة أو أجر كل مرحلة لكل منتج.</Bullet>
            </ul>
          </SectionCard>

          <SectionCard
            title="المراحل الإنتاجية"
            description="القص، الخياطة، الجودة، التغليف وغيرها"
            icon={<ArrowRightLeft className="h-5 w-5" />}
          >
            <ul className="space-y-3">
              <Bullet>تعريف المراحل وترتيبها داخل النظام.</Bullet>
              <Bullet>تحديد هل المرحلة مفعلة أم لا.</Bullet>
              <Bullet>ربط العاملين بكل مرحلة.</Bullet>
              <Bullet>متابعة الطلب أو القطعة داخل كل مرحلة.</Bullet>
            </ul>
          </SectionCard>

          <SectionCard
            title="ربط المنتجات بالمراحل والأسعار"
            description="القلب الفعلي للتشغيل"
            icon={<ClipboardList className="h-5 w-5" />}
          >
            <ul className="space-y-3">
              <Bullet>
                ليس كل منتج يمر بنفس المراحل، لذلك يجب تحديد ذلك بدقة.
              </Bullet>
              <Bullet>لكل منتج يمكن تحديد المرحلة هل هي مطلوبة أم لا.</Bullet>
              <Bullet>لكل منتج ولكل مرحلة يمكن تحديد السعر أو الأجر.</Bullet>
              <Bullet>
                هذا الربط هو الأساس لحساب المستحقات والتكلفة والتقارير.
              </Bullet>
            </ul>
          </SectionCard>

          <SectionCard
            title="الطلبات وعناصر الإنتاج"
            description="تحويل الطلب من المتجر إلى قطع تشغيل داخلية"
            icon={<Boxes className="h-5 w-5" />}
          >
            <ul className="space-y-3">
              <Bullet>دخول الطلب من سلة وحفظ بياناته.</Bullet>
              <Bullet>قراءة المنتجات والكميات داخل الطلب.</Bullet>
              <Bullet>تحويل الطلب إلى عناصر إنتاج منفصلة.</Bullet>
              <Bullet>
                إعطاء كل عنصر باركود أو QR وترتيب طباعة وحالة تشغيل.
              </Bullet>
            </ul>
          </SectionCard>

          <SectionCard
            title="الطباعة"
            description="أوراق التشغيل والباركود"
            icon={<Printer className="h-5 w-5" />}
          >
            <ul className="space-y-3">
              <Bullet>إنشاء دفعات طباعة.</Bullet>
              <Bullet>تجهيز ورقة التشغيل لكل عنصر أو طلب.</Bullet>
              <Bullet>إظهار رقم الطلب واسم المنتج وSKU والباركود.</Bullet>
              <Bullet>
                التأكد من عدم قص الباركود أو وجود مشاكل في آخر صفحة.
              </Bullet>
            </ul>
          </SectionCard>

          <SectionCard
            title="العاملين"
            description="تعريف العامل وربطه بمرحلة وطريقة دفع"
            icon={<Users className="h-5 w-5" />}
          >
            <ul className="space-y-3">
              <Bullet>إضافة العامل وربط المستخدم الخاص به.</Bullet>
              <Bullet>تحديد المرحلة الحالية أو الأساسية له.</Bullet>
              <Bullet>تحديد نوع الدفع: راتب أو بالقطعة أو مختلط.</Bullet>
              <Bullet>تفعيل الهدف الشهري والبونص عند الحاجة.</Bullet>
            </ul>
          </SectionCard>

          <SectionCard
            title="المخزون"
            description="الخامات، الأقمشة، المستلزمات، والكميات"
            icon={<Boxes className="h-5 w-5" />}
          >
            <ul className="space-y-3">
              <Bullet>إضافة المواد والخامات ووحدة القياس.</Bullet>
              <Bullet>عرض الكمية المتبقية والحالة.</Bullet>
              <Bullet>تحديد حد التنبيه لكل مادة.</Bullet>
              <Bullet>أرشفة المواد بدل حذفها عند الحاجة.</Bullet>
            </ul>
          </SectionCard>

          <SectionCard
            title="حركة المخزون"
            description="سجل الإضافة والصرف والتسوية"
            icon={<Package className="h-5 w-5" />}
          >
            <ul className="space-y-3">
              <Bullet>تسجيل إضافة للمخزون.</Bullet>
              <Bullet>تسجيل صرف لمادة مرتبطة بطلب أو مرحلة أو موظف.</Bullet>
              <Bullet>معرفة من صرف وكم صرف ومتى صرف.</Bullet>
              <Bullet>متابعة سبب النقص أو الزيادة في الرصيد.</Bullet>
            </ul>
          </SectionCard>

          <SectionCard
            title="الجودة"
            description="متابعة الأخطاء والتنبيهات والإرجاع"
            icon={<ShieldCheck className="h-5 w-5" />}
          >
            <ul className="space-y-3">
              <Bullet>تسجيل ملاحظات الجودة على القطع.</Bullet>
              <Bullet>ربط التنبيه بمرحلة أو عامل.</Bullet>
              <Bullet>تتبع العناصر المرتجعة للتعديل.</Bullet>
              <Bullet>استخدام الجودة ضمن تقييم العامل.</Bullet>
            </ul>
          </SectionCard>

          <SectionCard
            title="المستحقات والمحفظة"
            description="الجانب المالي للعامل والعميل"
            icon={<Wallet className="h-5 w-5" />}
          >
            <ul className="space-y-3">
              <Bullet>حساب مستحقات العامل من الإنجاز.</Bullet>
              <Bullet>إظهار الدائن والمدين والصرف والرصيد.</Bullet>
              <Bullet>متابعة محفظة العميل والمدفوع والمتبقي.</Bullet>
              <Bullet>ربط الطلبات بالحسابات المالية.</Bullet>
            </ul>
          </SectionCard>
        </div>

        <SectionCard
          title="مسار الطلب داخل النظام"
          description="كيف يتحرك الطلب من المتجر حتى التقرير"
          icon={<BarChart3 className="h-5 w-5" />}
        >
          <ol className="space-y-3">
            <Bullet>يدخل الطلب من سلة.</Bullet>
            <Bullet>تُقرأ المنتجات والكميات والـ SKU.</Bullet>
            <Bullet>يتحول الطلب إلى عناصر إنتاج.</Bullet>
            <Bullet>يتم تحديد المراحل المطلوبة لكل عنصر.</Bullet>
            <Bullet>يتم إنشاء الباركود وتجهيز دفعة الطباعة.</Bullet>
            <Bullet>تبدأ مراحل التنفيذ داخل الإنتاج.</Bullet>
            <Bullet>يسجل كل عامل إنجازه على المرحلة.</Bullet>
            <Bullet>يُخصم الاستهلاك من المخزون.</Bullet>
            <Bullet>تُسجل الجودة والتنبيهات إن وجدت.</Bullet>
            <Bullet>تُحسب المستحقات وتظهر التقارير النهائية.</Bullet>
          </ol>
        </SectionCard>

        <SectionCard
          title="التشغيل اليومي المختصر"
          description="كيف يستخدم الفريق النظام يوميًا"
          icon={<BookOpen className="h-5 w-5" />}
        >
          <ol className="space-y-3">
            <Bullet>مزامنة الطلبات الجديدة من سلة.</Bullet>
            <Bullet>مراجعة المنتجات غير المربوطة أو الناقصة.</Bullet>
            <Bullet>إنشاء دفعة طباعة للطلبات الجاهزة.</Bullet>
            <Bullet>بدء التنفيذ داخل المراحل.</Bullet>
            <Bullet>تسجيل إنجاز العاملين أولًا بأول.</Bullet>
            <Bullet>تسجيل أي صرف من المخزون.</Bullet>
            <Bullet>مراجعة الجودة والتنبيهات.</Bullet>
            <Bullet>متابعة الأداء والمستحقات والتقارير.</Bullet>
          </ol>
        </SectionCard>

        <SectionCard
          title="ملاحظات مهمة"
          description="حتى يمشي المشروع بشكل صحيح"
          icon={<ClipboardList className="h-5 w-5" />}
        >
          <ul className="space-y-3">
            <Bullet>
              لا تبدأ بالمخزون أو المالية قبل ضبط المنتجات والمراحل.
            </Bullet>
            <Bullet>
              أي خطأ في ربط المنتج بالمراحل سيؤثر على الطباعة والمستحقات.
            </Bullet>
            <Bullet>أي خطأ في عناصر الإنتاج سيؤثر على التتبع والجودة.</Bullet>
            <Bullet>
              صفحة الدليل يفضل تحديثها كلما أضفت ميزة جديدة في النظام.
            </Bullet>
          </ul>
        </SectionCard>
      </div>
    </main>
  );
}
