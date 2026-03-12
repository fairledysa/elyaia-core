// FILE: src/app/page.tsx

import Link from "next/link";

function SectionTitle({
  badge,
  title,
  desc,
}: {
  badge: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700">
        {badge}
      </div>
      <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-sm leading-8 text-slate-600 md:text-base">
        {desc}
      </p>
    </div>
  );
}

function InfoCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(15,23,42,0.10)]">
      <div className="text-lg font-black text-slate-950">{title}</div>
      <p className="mt-3 text-sm leading-8 text-slate-600">{desc}</p>
    </div>
  );
}

function FeatureCard({
  title,
  desc,
  tone,
}: {
  title: string;
  desc: string;
  tone: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(15,23,42,0.10)]">
      <div
        className={`mb-5 inline-flex rounded-2xl px-3 py-2 text-xs font-black ${tone}`}
      >
        ميزة
      </div>
      <h3 className="text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-8 text-slate-600">{desc}</p>
      <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="mt-4 text-xs font-bold text-slate-400 transition group-hover:text-slate-700">
        مخصص للمشاغل ومتاجر العبايات على سلة
      </div>
    </div>
  );
}

function StageBadge({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">
      {label}
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/10 px-5 py-6 text-center text-white shadow-xl backdrop-blur-xl">
      <div className="text-3xl font-black md:text-4xl">{value}</div>
      <div className="mt-2 text-sm text-white/75">{label}</div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f7f8fc]" dir="rtl">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a,#1d4ed8,#7c3aed)] text-sm font-black text-white shadow-[0_10px_30px_rgba(79,70,229,0.35)]">
              E
            </div>

            <div>
              <div className="text-lg font-black text-slate-950">
                Elyaia Production
              </div>
              <div className="text-xs text-slate-500">
                نظام إدارة إنتاج لمتاجر العبايات والمشاغل
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-bold text-slate-600 md:flex">
            <a href="#home" className="transition hover:text-slate-950">
              الرئيسية
            </a>
            <a href="#about" className="transition hover:text-slate-950">
              من نحن
            </a>
            <a href="#workflow" className="transition hover:text-slate-950">
              كيف يعمل
            </a>
            <a href="#services" className="transition hover:text-slate-950">
              خدماتنا
            </a>
            <a href="#stages" className="transition hover:text-slate-950">
              المراحل
            </a>
            <a href="#support" className="transition hover:text-slate-950">
              الدعم الفني
            </a>
            <a href="#privacy" className="transition hover:text-slate-950">
              سياسة الخصوصية
            </a>
            <a href="#faq" className="transition hover:text-slate-950">
              الأسئلة الشائعة
            </a>
            <a href="#contact" className="transition hover:text-slate-950">
              اتصل بنا
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/production-login"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              دخول العامل
            </Link>

            <Link
              href="/login"
              className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-lg transition hover:opacity-90"
            >
              دخول الإدارة
            </Link>
          </div>
        </div>
      </header>

      <section
        id="home"
        className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.35),_transparent_24%),linear-gradient(135deg,#071126,#0f172a,#1e3a8a,#312e81)] px-4 py-16 text-white md:px-6 md:py-24"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />

        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black text-white/85 backdrop-blur">
              مخصص لمتاجر العبايات المرتبطة بمنصة سلة
            </div>

            <h1 className="mt-6 text-4xl font-black leading-[1.15] tracking-tight md:text-6xl">
              حول متجر العبايات
              <br />
              إلى تشغيل احترافي
              <br />
              داخل المشغل
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/78 md:text-lg">
              نظام عربي فاخر لإدارة الطلبات القادمة من سلة، وتحويلها مباشرة إلى
              خط إنتاج واضح داخل المشغل، مع متابعة العامل، مراحل التنفيذ،
              الباركود، التسعير، الرواتب، المحفظة، والمخزون داخل منصة واحدة.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-slate-950 shadow-xl transition hover:opacity-90"
              >
                دخول الإدارة
              </Link>

              <Link
                href="/production-login"
                className="rounded-2xl border border-white/15 bg-white/10 px-6 py-3.5 text-sm font-black text-white backdrop-blur transition hover:bg-white/15"
              >
                دخول العامل
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard value="سلة" label="ربط مباشر مع المتجر" />
              <StatCard value="باركود" label="تنفيذ فعلي داخل المشغل" />
              <StatCard value="محفظة" label="حساب العامل تلقائيًا" />
              <StatCard value="مخزون" label="مواد وحركات دقيقة" />
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[38px] bg-[radial-gradient(circle,_rgba(99,102,241,0.35),_transparent_60%)] blur-2xl" />

            <div className="relative rounded-[34px] border border-white/10 bg-white/10 p-4 shadow-[0_20px_80px_rgba(15,23,42,0.35)] backdrop-blur-2xl md:p-5">
              <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/60">
                      بطاقة الطلب داخل النظام
                    </div>
                    <div className="mt-1 text-2xl font-black">
                      كل طلب يتحول إلى ملف إنتاج واضح
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-white/80">
                    Live
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  <div className="rounded-[24px] bg-white/10 p-4">
                    <div className="text-xs text-white/60">معلومات الطلب</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-white/85">
                      <div className="rounded-2xl bg-white/10 px-3 py-2">
                        رقم الطلب
                      </div>
                      <div className="rounded-2xl bg-white/10 px-3 py-2">
                        اسم العميل
                      </div>
                      <div className="rounded-2xl bg-white/10 px-3 py-2">
                        الجوال
                      </div>
                      <div className="rounded-2xl bg-white/10 px-3 py-2">
                        المدينة
                      </div>
                      <div className="rounded-2xl bg-white/10 px-3 py-2">
                        المنتج / SKU
                      </div>
                      <div className="rounded-2xl bg-white/10 px-3 py-2">
                        الكمية
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] bg-white/10 p-4">
                    <div className="text-xs text-white/60">بيانات التشغيل</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-white/85">
                      <div className="rounded-2xl bg-white/10 px-3 py-2">
                        باركود لكل قطعة
                      </div>
                      <div className="rounded-2xl bg-white/10 px-3 py-2">
                        المرحلة الحالية
                      </div>
                      <div className="rounded-2xl bg-white/10 px-3 py-2">
                        العامل المنفذ
                      </div>
                      <div className="rounded-2xl bg-white/10 px-3 py-2">
                        حالة التنفيذ
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] bg-white/10 p-4">
                    <div className="text-xs text-white/60">الفكرة</div>
                    <div className="mt-2 text-sm leading-7 text-white/78">
                      الطلب القادم من سلة لا يبقى فقط كطلب متجر، بل يتحول داخل
                      النظام إلى بطاقة تشغيل احترافية قابلة للطباعة، المتابعة،
                      والمسح بالباركود خطوة بخطوة.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/10 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                <div className="text-lg font-black text-white">
                  إدارة التشغيل
                </div>
                <p className="mt-3 text-sm leading-8 text-white/75">
                  ربط الطلبات الواردة من سلة بالمشغل مباشرة، وتحويلها إلى خطوات
                  تنفيذ واضحة يمكن متابعتها بدقة من البداية حتى التسليم.
                </p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/10 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                <div className="text-lg font-black text-white">
                  تنفيذ بالباركود
                </div>
                <p className="mt-3 text-sm leading-8 text-white/75">
                  كل قطعة لها باركود خاص بها، والعامل يمسحها عند التنفيذ لتسجيل
                  المرحلة والعامل والتاريخ بشكل تلقائي داخل النظام.
                </p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/10 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                <div className="text-lg font-black text-white">
                  تقارير ومحاسبة
                </div>
                <p className="mt-3 text-sm leading-8 text-white/75">
                  متابعة جاهزية الطلبات، إنتاجية العامل، المحفظة المالية،
                  والمخزون من خلال لوحة واضحة تناسب العمل اليومي داخل المشغل.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="px-4 py-20 md:px-6">
        <SectionTitle
          badge="من نحن"
          title="نظام مصمم فعلًا لمشاغل العبايات"
          desc="هذا النظام ليس عامًا لكل المتاجر فقط، بل موجه تحديدًا للمتاجر التي تبيع على سلة ولديها مشغل أو خط إنتاج داخلي، وتحتاج إلى ربط الطلب بالتنفيذ الفعلي داخل الورشة أو المصنع."
        />

        <div className="mx-auto mt-12 grid max-w-6xl gap-6 lg:grid-cols-3">
          <InfoCard
            title="ربط المتجر بالمشغل"
            desc="بمجرد وصول الطلب من سلة، يتم إدخاله إلى النظام وتحويله إلى عناصر إنتاج قابلة للتشغيل داخل المشغل بدل أن يبقى مجرد طلب إلكتروني فقط."
          />
          <InfoCard
            title="تشغيل منظم"
            desc="كل عباءة أو قطعة تمر بمراحل واضحة، ويمكن للإدارة معرفة من استلمها، من نفذها، وفي أي مرحلة وصلت، ومتى اكتمل العمل عليها."
          />
          <InfoCard
            title="متابعة فعلية للعامل"
            desc="العامل لا يعمل بشكل عشوائي، بل يستلم القطعة ويمسح الباركود، ويُحسب له الإنجاز تلقائيًا حسب النظام المالي المعتمد."
          />
        </div>
      </section>

      <section id="workflow" className="bg-white px-4 py-20 md:px-6">
        <SectionTitle
          badge="كيف يعمل النظام"
          title="رحلة الطلب من سلة إلى يد العامل"
          desc="النظام يربط بين متجر العبايات وبين المشغل بطريقة عملية جدًا، بحيث تنتقل البيانات من الطلب الإلكتروني إلى التنفيذ الواقعي داخل المصنع."
        />

        <div className="mx-auto mt-12 grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-4">
          <FeatureCard
            title="1) استيراد الطلب"
            desc="يتم جلب الطلبات من سلة تلقائيًا مع بيانات العميل والمنتج والكمية وحالة الطلب ومعلومات القطعة."
            tone="bg-blue-50 text-blue-700"
          />
          <FeatureCard
            title="2) إنشاء بطاقة إنتاج"
            desc="كل طلب أو كل قطعة تتحول إلى بطاقة تشغيل تحتوي على بياناتها، ويمكن طباعتها أو التعامل معها داخل النظام."
            tone="bg-violet-50 text-violet-700"
          />
          <FeatureCard
            title="3) تنفيذ بالباركود"
            desc="العامل يمسك القطعة ويمسح الباركود عند التنفيذ، فيسجل النظام المرحلة والعامل والتاريخ ويحتسب له الإنجاز."
            tone="bg-emerald-50 text-emerald-700"
          />
          <FeatureCard
            title="4) تقارير ومحاسبة"
            desc="بعد التنفيذ تظهر التقارير، ويتم احتساب المستحقات في المحفظة حسب الراتب أو حسب الحبة أو حسب تسعيرة المنتج."
            tone="bg-amber-50 text-amber-700"
          />
        </div>
      </section>

      <section id="services" className="px-4 py-20 md:px-6">
        <SectionTitle
          badge="خدماتنا"
          title="كل ما يحتاجه متجر العبايات والمشغل"
          desc="النظام يجمع بين التجارة والإنتاج والإدارة التشغيلية داخل تجربة واحدة، وهو مبني على احتياجات المشغل الحقيقي وليس مجرد عرض نظري."
        />

        <div className="mx-auto mt-12 grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-3">
          <FeatureCard
            title="إدارة الطلبات"
            desc="جلب الطلبات من سلة، عرضها بشكل واضح، تجهيزها للطباعة، وتحويلها إلى عناصر إنتاج داخلية قابلة للتنفيذ."
            tone="bg-blue-50 text-blue-700"
          />
          <FeatureCard
            title="بطاقة الطلب"
            desc="لكل طلب أو قطعة بطاقة فيها: رقم الطلب، اسم العميل، المدينة، المنتج، SKU، الكمية، وحالة التنفيذ والملاحظات."
            tone="bg-violet-50 text-violet-700"
          />
          <FeatureCard
            title="نظام الباركود"
            desc="كل قطعة تملك QR أو باركود، والعامل يمسح عليها عند التنفيذ، فينتقل الطلب بين المراحل ويُسجل الإنجاز تلقائيًا."
            tone="bg-emerald-50 text-emerald-700"
          />
          <FeatureCard
            title="إدارة مراحل الإنتاج"
            desc="النظام يدعم ترتيب المراحل وربط كل مرحلة بمنتجات محددة، مع تتبع دقيق لكل قطعة داخل خط الإنتاج."
            tone="bg-amber-50 text-amber-700"
          />
          <FeatureCard
            title="رواتب ومحاسبة العامل"
            desc="يمكن أن يكون العامل براتب ثابت أو بالحبة، مع نظام محفظة يسجل السلف والخصومات والمكافآت والمستحقات."
            tone="bg-slate-100 text-slate-700"
          />
          <FeatureCard
            title="المخزون والمواد"
            desc="إدارة الأقمشة والمواد الخام، تسجيل الحركات، الاستلام، الصرف، وحدود التنبيه، وربط المواد بالمنتجات."
            tone="bg-rose-50 text-rose-700"
          />
        </div>
      </section>

      <section id="stages" className="bg-white px-4 py-20 md:px-6">
        <SectionTitle
          badge="مراحل المشغل"
          title="مراحل واضحة تناسب تشغيل العبايات"
          desc="يمكن تخصيص المراحل حسب نوع المشغل، لكن النظام مبني ليدعم المراحل الشائعة داخل مشاغل العبايات والإنتاج التفصيلي."
        />

        <div className="mx-auto mt-12 max-w-6xl rounded-[34px] border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StageBadge label="استلام الطلب" />
            <StageBadge label="القصاص" />
            <StageBadge label="الخياط" />
            <StageBadge label="التطريز" />
            <StageBadge label="التركيب / التشطيب" />
            <StageBadge label="الكي" />
            <StageBadge label="الفحص والجودة" />
            <StageBadge label="التغليف" />
          </div>

          <p className="mt-6 text-sm leading-8 text-slate-600">
            ويمكن للنظام ترتيب المراحل حسب شغلك، وتحديد هل كل مرحلة إلزامية، وهل
            تخصم مواد من المخزون، وما هي مكافأة التنفيذ المرتبطة بها.
          </p>
        </div>
      </section>

      <section className="px-4 py-20 md:px-6">
        <SectionTitle
          badge="نظام العامل"
          title="العامل يمسك القطعة ويمسح الباركود"
          desc="هذه من أهم مزايا النظام، لأن الإنجاز لا يُحسب يدويًا أو بالتخمين، بل بالمسح الفعلي عند تنفيذ القطعة."
        />

        <div className="mx-auto mt-12 grid max-w-6xl gap-6 lg:grid-cols-2">
          <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="text-xl font-black text-slate-950">
              كيف يتم الاحتساب؟
            </div>
            <p className="mt-4 text-sm leading-8 text-slate-600">
              عندما يستلم العامل القطعة ويمسح الباركود داخل صفحة التنفيذ، يقوم
              النظام بتسجيل اسم العامل، المرحلة، القطعة، والتاريخ، ثم يضيف هذا
              الإنجاز إلى إنتاجه اليومي والأسبوعي والشهري.
            </p>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="text-xl font-black text-slate-950">
              ماذا يرى العامل؟
            </div>
            <p className="mt-4 text-sm leading-8 text-slate-600">
              للعامل صفحة خاصة تظهر له إنتاجه، متوسط الجودة، التحذيرات،
              المكافآت، الاسكور العام، والمحفظة المالية، ليكون عنده ملف واضح عن
              أدائه داخل المشغل.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-20 md:px-6">
        <SectionTitle
          badge="الرواتب والتسعير"
          title="مرونة كاملة في طريقة احتساب المستحقات"
          desc="المشغل لا يعمل دائمًا بنفس النظام، لذلك يدعم النظام أكثر من طريقة محاسبة للعامل بحسب طبيعة التشغيل."
        />

        <div className="mx-auto mt-12 grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-3">
          <FeatureCard
            title="راتب ثابت"
            desc="يمكن تسجيل العامل كموظف براتب شهري ثابت، مع متابعة إنتاجه وجودته وتنبيهاته دون ربط الراتب المباشر بعدد القطع."
            tone="bg-blue-50 text-blue-700"
          />
          <FeatureCard
            title="نظام بالحبة"
            desc="إذا كان العامل يُحاسب على كل قطعة، فإن كل تنفيذ يتم احتسابه تلقائيًا من خلال الباركود والمرحلة المنفذة."
            tone="bg-emerald-50 text-emerald-700"
          />
          <FeatureCard
            title="تسعيرة المنتج"
            desc="يمكن ربط المنتج أو المرحلة بتسعيرة محددة، بحيث تختلف تكلفة التنفيذ حسب نوع العباءة أو المنتج أو المرحلة."
            tone="bg-violet-50 text-violet-700"
          />
        </div>
      </section>

      <section className="px-4 py-20 md:px-6">
        <SectionTitle
          badge="المحفظة"
          title="محفظة مالية واضحة لكل عامل"
          desc="النظام لا يحسب الإنجاز فقط، بل يبني أيضًا ملفًا ماليًا واضحًا لكل عامل داخل المشغل."
        />

        <div className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-2">
          <InfoCard
            title="ما الذي يدخل في المحفظة؟"
            desc="الراتب، مستحقات الحبة، المكافآت، السلف، الخصومات، والمدفوعات، بحيث يكون لدى الإدارة كشف واضح ولدى العامل رصيد مفهوم."
          />
          <InfoCard
            title="لماذا هذا مهم؟"
            desc="لأن كثيرًا من المشاغل تضيع فيها مستحقات العامل أو تصبح الحسابات غير واضحة، بينما هنا كل حركة مالية مسجلة وقابلة للمراجعة."
          />
        </div>
      </section>

      <section className="bg-white px-4 py-20 md:px-6">
        <SectionTitle
          badge="المخزون"
          title="إدارة الأقمشة والمواد الخام بشكل دقيق"
          desc="المخزون في النظام ليس مجرد رقم، بل حركة كاملة للمواد المرتبطة بالإنتاج."
        />

        <div className="mx-auto mt-12 grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-3">
          <FeatureCard
            title="تعريف المواد"
            desc="إضافة الأقمشة والمواد الخام مثل القماش والخيط والأزرار، مع الوحدة والتكلفة والكمية الحالية."
            tone="bg-blue-50 text-blue-700"
          />
          <FeatureCard
            title="حركة المخزون"
            desc="استلام، إضافة، صرف، تعديل، أو خصم مرتبط بالإنتاج، مع تقارير تفصيلية لكل حركة."
            tone="bg-amber-50 text-amber-700"
          />
          <FeatureCard
            title="ربط المواد بالمنتج"
            desc="يمكن ربط كل منتج أو عباءة بالمواد التي يستهلكها، حتى يصبح التشغيل والمحاسبة والمخزون أكثر دقة."
            tone="bg-rose-50 text-rose-700"
          />
        </div>
      </section>

      <section id="support" className="scroll-mt-28 px-4 py-20 md:px-6">
        <SectionTitle
          badge="الدعم الفني"
          title="فريق جاهز لمساعدتك في أي وقت تحتاجه"
          desc="إذا واجهتك أي مشكلة في تشغيل النظام أو الربط أو الصلاحيات أو مسارات العمل داخل المشغل، يمكنك التواصل معنا مباشرة لنساعدك في حل المشكلة بسرعة ووضوح."
        />

        <div className="mx-auto mt-12 grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="text-xl font-black text-slate-950">
              كيف يساعدك الدعم الفني؟
            </div>
            <p className="mt-4 text-sm leading-8 text-slate-600">
              نساعدك في مشاكل تسجيل الدخول، الربط مع سلة، إعداد مراحل الإنتاج،
              الطباعة، الباركود، متابعة الحسابات، وإصلاح أي مشكلة تعيق العمل
              اليومي داخل المشغل.
            </p>
            <p className="mt-4 text-sm leading-8 text-slate-600">
              كل ما عليك هو إرسال وصف واضح للمشكلة واسم المنشأة أو رقم الطلب إن
              وجد، وسنقوم بمتابعة الحالة معك حتى يتم حلها.
            </p>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a,#1d4ed8,#7c3aed)] p-7 text-white shadow-[0_20px_80px_rgba(37,99,235,0.20)]">
            <div className="text-sm font-black text-white/75">
              البريد الإلكتروني للدعم
            </div>
            <div className="mt-4 break-all text-2xl font-black">
              bkeficom@gmail.com
            </div>
            <p className="mt-4 text-sm leading-8 text-white/80">
              اكتب لنا تفاصيل المشكلة أو الاستفسار، وسنقوم بالرد عليك ومتابعة
              الحالة بالشكل المناسب.
            </p>
          </div>
        </div>
      </section>

      <section
        id="privacy"
        className="scroll-mt-28 bg-white px-4 py-20 md:px-6"
      >
        <SectionTitle
          badge="سياسة الخصوصية"
          title="بياناتك داخل النظام تعامل بسرية وحماية"
          desc="نحن نلتزم بحماية بيانات المتجر والطلبات والعاملين والعمليات التشغيلية داخل النظام، ونعمل على استخدام البيانات فقط للأغراض المرتبطة بتقديم الخدمة وتحسينها."
        />

        <div className="mx-auto mt-12 grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-3">
          <InfoCard
            title="استخدام البيانات"
            desc="يتم استخدام البيانات فقط لتشغيل النظام، إدارة الطلبات، متابعة مراحل الإنتاج، تحسين تجربة الاستخدام، وتقديم الدعم الفني عند الحاجة."
          />
          <InfoCard
            title="عدم مشاركة البيانات"
            desc="لا يتم بيع البيانات أو مشاركتها مع أي طرف ثالث خارج نطاق الخدمة، إلا عند وجود متطلب تقني ضروري لتشغيل النظام أو التزام نظامي ملزم."
          />
          <InfoCard
            title="حماية الوصول"
            desc="نحرص على أن تكون صلاحيات الوصول والبيانات التشغيلية داخل النظام منظمة وآمنة بما يتناسب مع طبيعة العمل داخل المشغل والمنشأة."
          />
        </div>
      </section>

      <section id="faq" className="scroll-mt-28 px-4 py-20 md:px-6">
        <SectionTitle
          badge="الأسئلة الشائعة"
          title="إجابات واضحة عن أكثر الأسئلة تكرارًا"
          desc="هذه أبرز الأسئلة التي يطرحها أصحاب المتاجر والمشاغل عند استخدام النظام لأول مرة أو عند بدء تشغيل الإنتاج وربطه مع سلة."
        />

        <div className="mx-auto mt-12 grid max-w-6xl gap-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-black text-slate-950">
              كيف يتم تتبع الطلبات داخل المشغل؟
            </div>
            <p className="mt-3 text-sm leading-8 text-slate-600">
              يتم تحويل الطلب القادم من سلة إلى بطاقة تشغيل داخلية، وكل قطعة
              يكون لها باركود خاص بها. عند مسح الباركود يسجل النظام المرحلة
              الحالية والعامل المسؤول ووقت التنفيذ.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-black text-slate-950">
              هل يمكن متابعة المخزون والمواد الخام؟
            </div>
            <p className="mt-3 text-sm leading-8 text-slate-600">
              نعم، النظام يدعم تعريف المواد الخام، وحركات الإضافة والصرف
              والتعديل، والتنبيهات عند انخفاض الكمية، وربط المواد بالمنتجات
              والمراحل التشغيلية.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-black text-slate-950">
              هل النظام مرتبط مع منصة سلة؟
            </div>
            <p className="mt-3 text-sm leading-8 text-slate-600">
              نعم، يتم جلب الطلبات من سلة وتحويلها مباشرة إلى عناصر إنتاج داخل
              المشغل، مما يختصر الإدخال اليدوي ويجعل المتابعة أكثر دقة.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-black text-slate-950">
              كيف يتم احتساب مستحقات العامل؟
            </div>
            <p className="mt-3 text-sm leading-8 text-slate-600">
              يمكن احتسابها براتب ثابت أو بالحبة أو وفق تسعيرة مرتبطة بالمنتج أو
              المرحلة، وكل تنفيذ يتم تسجيله داخل النظام ليظهر أثره في المحفظة
              المالية للعامل.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 md:px-6" id="contact">
        <SectionTitle
          badge="اتصل بنا"
          title="هذا النظام لمن يريد تشغيلًا احترافيًا"
          desc="إذا كان لديك متجر عبايات على سلة ولديك مشغل أو فريق إنتاج وتريد تنظيم العمل بشكل فاخر واحترافي، فهذا النظام صمم لك."
        />

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
          <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6 text-center">
            <div className="text-sm font-black text-slate-950">البريد</div>
            <div className="mt-3 text-sm text-slate-600">
              bkeficom@gmail.com
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6 text-center">
            <div className="text-sm font-black text-slate-950">المنطقة</div>
            <div className="mt-3 text-sm text-slate-600">
              المملكة العربية السعودية
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 md:px-6">
        <div className="mx-auto max-w-6xl rounded-[36px] bg-[linear-gradient(135deg,#0f172a,#1d4ed8,#7c3aed)] px-6 py-12 text-center text-white shadow-[0_20px_80px_rgba(37,99,235,0.25)] md:px-10 md:py-16">
          <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-white/80">
            جاهز للتشغيل
          </div>

          <h2 className="mt-5 text-3xl font-black md:text-5xl">
            اربط متجر العبايات
            <br />
            بالمشغل باحتراف
          </h2>

          <p className="mx-auto mt-5 max-w-3xl text-sm leading-8 text-white/80 md:text-base">
            إذا كنت تريد نظامًا يشبه شغلك الحقيقي، ويعرف كيف ينتقل الطلب من سلة
            إلى القصاص ثم الخياط ثم الجودة ثم التغليف مع احتساب العامل والمخزون
            والمحفظة، فهذا هو النظام الذي سيختصر عليك الفوضى ويعطيك وضوحًا
            كاملًا.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-slate-950 shadow-xl transition hover:opacity-90"
            >
              دخول الإدارة
            </Link>

            <Link
              href="/production-login"
              className="rounded-2xl border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-black text-white backdrop-blur transition hover:bg-white/15"
            >
              دخول العامل
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-black text-slate-950">Elyaia Production</div>
            <div className="mt-1 text-sm text-slate-500">
              نظام عربي فاخر لمتاجر العبايات والمشاغل على سلة
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm font-medium text-slate-500">
            <a href="#home" className="hover:text-slate-950">
              الرئيسية
            </a>
            <a href="#about" className="hover:text-slate-950">
              من نحن
            </a>
            <a href="#workflow" className="hover:text-slate-950">
              كيف يعمل
            </a>
            <a href="#services" className="hover:text-slate-950">
              خدماتنا
            </a>
            <a href="#stages" className="hover:text-slate-950">
              المراحل
            </a>
            <a href="#support" className="hover:text-slate-950">
              الدعم الفني
            </a>
            <a href="#privacy" className="hover:text-slate-950">
              سياسة الخصوصية
            </a>
            <a href="#faq" className="hover:text-slate-950">
              الأسئلة الشائعة
            </a>
            <a href="#contact" className="hover:text-slate-950">
              اتصل بنا
            </a>
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-7xl border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Elyaia Production. جميع الحقوق محفوظة.
        </div>
      </footer>
    </div>
  );
}
