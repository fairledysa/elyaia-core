export async function POST(req: Request) {
  const body = await req.json();

  console.log("🔥 Webhook received:");
  console.log(JSON.stringify(body, null, 2));

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
