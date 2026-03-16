export async function sendWelcomeEmail(email: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!apiKey) {
    console.error("Missing RESEND_API_KEY");
    return;
  }

  if (!appUrl) {
    console.error("Missing NEXT_PUBLIC_APP_URL");
    return;
  }

  const url = `${appUrl}/login`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Elyaia Production <no-reply@elyaia.com>",
        to: [email],
        subject: "تم ربط متجرك مع نظام إدارة الإنتاج",
        html: `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
</head>

<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05)">

<tr>
<td align="center" style="padding:30px 20px;border-bottom:1px solid #eee">

<img src="https://app.elyaia.com/logo.png" width="70" style="margin-bottom:10px">

<h2 style="margin:0;font-size:22px;color:#111">
مرحباً بك في نظام إدارة الإنتاج
</h2>

</td>
</tr>

<tr>
<td style="padding:30px 40px;text-align:center">

<p style="font-size:16px;color:#444;line-height:1.8;margin:0 0 20px">
تم ربط متجرك في <b>سلة</b> بنجاح مع نظام إدارة الإنتاج.
</p>

<p style="font-size:15px;color:#666;line-height:1.8;margin:0 0 30px">
يمكنك الآن الدخول إلى لوحة التحكم لإدارة الطلبات وتتبع مراحل الإنتاج بسهولة.
</p>

<a href="${url}"
style="
display:inline-block;
background:#111;
color:#fff;
text-decoration:none;
padding:14px 28px;
border-radius:8px;
font-size:15px;
font-weight:bold;
">
الدخول إلى لوحة التحكم
</a>

</td>
</tr>

<tr>
<td style="padding:20px;text-align:center;background:#fafafa;font-size:12px;color:#888">

<p style="margin:0">
Elyaia Production System
</p>

<p style="margin:6px 0 0 0">
هذا البريد أُرسل تلقائياً بعد ربط متجرك بنظام الإنتاج.
</p>

</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
        `,
      }),
    });

    const text = await res.text();
    console.log("RESEND RESPONSE:", res.status, text);

    if (!res.ok) {
      console.error("Welcome email failed:", text);
    }
  } catch (err) {
    console.error("Welcome email error:", err);
  }
}