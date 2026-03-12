// redeploy test// redeploy test
export default function Page() {
  return (
    <div className="grid gap-4">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="aspect-video rounded-xl bg-muted/50" />
        <div className="aspect-video rounded-xl bg-muted/50" />
        <div className="aspect-video rounded-xl bg-muted/50" />
      </div>
      <div className="min-h-[60vh] rounded-xl bg-muted/50" />
    </div>
  );
}
