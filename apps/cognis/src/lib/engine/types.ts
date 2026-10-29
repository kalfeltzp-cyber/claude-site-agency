export type Difficulty = 1 | 2 | 3;
export type { Blueprint } from "../questions/schema";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: "Fácil", 2: "Médio", 3: "Difícil" };
