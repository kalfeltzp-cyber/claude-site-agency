/**
 * Infraestrutura mínima de internacionalização. Hoje só pt-BR está publicado;
 * para um novo idioma: adicione o dicionário, traduza os textos das páginas e
 * ADAPTE (não apenas traduza) as questões, recalculando estatísticas por idioma
 * conforme as diretrizes da ITC (2018).
 */
import { ptBR } from "./pt-BR";

export const LOCALES = ["pt-BR"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt-BR";

export type Messages = typeof ptBR;
const dictionaries: Record<Locale, Messages> = { "pt-BR": ptBR };

export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export const t = getMessages();

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m) return `${m} min ${String(s).padStart(2, "0")} s`;
  return `${s} s`;
}

export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const dateOnlyFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatDateShort = (iso: string) => dateOnlyFmt.format(new Date(iso));
export const formatPct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
export const formatNum = (n: number, digits = 1) => n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
