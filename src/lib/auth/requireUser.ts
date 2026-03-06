// FILE: src/lib/auth/requireUser.ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function requireUser() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        // ✅ مهم: في Server Components Next يمنع تعديل cookies
        // فنحاول، وإذا منعها Next نتجاهل عشان ما يطيح /dashboard
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // ignore: cannot set cookies in Server Component
        }
      },
    },
  });

  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) redirect("/login");

  return { sb, user: data.user };
}
