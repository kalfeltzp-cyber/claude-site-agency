import type { ResultView } from "@/lib/services/assessment";
import { formatDuration, t } from "@/lib/i18n";
import { GlyphCell, QuestionFigure } from "../figures/figure";
import { cn } from "../ui/cn";

/** Revisão item a item com gabarito e explicação (somente para o titular). */
export function ItemReview({ items }: { items: ResultView["items"] }) {
  return (
    <ol className="space-y-6">
      {items.map((it) => (
        <li key={it.questionId} className="break-inside-avoid rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-muted">Questão {it.position + 1}</span>
            <span className="rounded-full border border-line px-2 py-0.5 text-muted">{it.categoryName}</span>
            <span className="rounded-full border border-line px-2 py-0.5 text-muted">{t.difficulty[it.difficulty]}</span>
            <span className="text-faint">{formatDuration(it.timeSpentMs)}</span>
            <span
              className={cn(
                "ml-auto rounded-full px-2.5 py-0.5 font-medium",
                it.isCorrect === true ? "bg-good/15 text-good" : it.isCorrect === false ? "bg-bad/15 text-bad" : "bg-surface-2 text-muted",
              )}
            >
              {it.isCorrect === true ? "✓ Correta" : it.isCorrect === false ? "× Incorreta" : "– Não respondida"}
            </span>
          </div>
          {it.stimulus && (
            <p className="mt-3 text-sm text-muted">
              Conteúdo memorizado: <span className="font-mono text-ink">{it.stimulus}</span>
            </p>
          )}
          <p className="mt-3 whitespace-pre-line text-ink">{it.prompt}</p>
          {it.figure && (
            <div className="mt-4 max-w-xs">
              <QuestionFigure figure={it.figure} />
            </div>
          )}
          <ul className={cn("mt-4 grid gap-2", it.options.some((o) => o.figure) ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-1 sm:grid-cols-2")}>
            {it.options.map((o) => (
              <li
                key={o.label}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-2 text-sm",
                  o.isAnswer ? "border-good/60 bg-good/[0.07]" : o.isSelected ? "border-bad/60 bg-bad/[0.07]" : "border-line",
                  o.figure && "flex-col",
                )}
              >
                <span className="font-mono text-xs text-muted">{o.label}</span>
                {o.figure ? <GlyphCell glyph={o.figure} className="size-12" /> : <span>{o.text}</span>}
                <span className="sr-only">{o.isAnswer ? "(gabarito)" : ""}{o.isSelected ? "(sua resposta)" : ""}</span>
                {(o.isAnswer || o.isSelected) && (
                  <span aria-hidden className={cn("text-[11px]", o.isAnswer ? "text-good" : "text-bad", !o.figure && "ml-auto")}>
                    {o.isAnswer ? "gabarito" : "sua resposta"}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg bg-surface-2 p-3 text-sm leading-relaxed text-muted">
            <strong className="text-ink">Explicação: </strong>
            {it.explanation}
          </p>
        </li>
      ))}
    </ol>
  );
}
