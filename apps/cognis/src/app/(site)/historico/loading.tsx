export default function Loading() {
  return (
    <div className="container py-24" role="status" aria-live="polite">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-10 w-2/3 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-4 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-surface-2" />
        <div className="h-48 w-full animate-pulse rounded-2xl bg-surface-2" />
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
