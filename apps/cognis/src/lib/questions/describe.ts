import type { Glyph } from "./schema";

/** Descrição textual de figuras para leitores de tela (equivalente textual). */

const SHAPE: Record<Glyph["shape"], [string, string]> = {
  circle: ["círculo", "círculos"],
  square: ["quadrado", "quadrados"],
  triangle: ["triângulo", "triângulos"],
  diamond: ["losango", "losangos"],
  pentagon: ["pentágono", "pentágonos"],
  hexagon: ["hexágono", "hexágonos"],
  star: ["estrela", "estrelas"],
  arrow: ["seta", "setas"],
  fshape: ["figura em forma de F", "figuras em forma de F"],
};

const FEMININE = new Set<Glyph["shape"]>(["star", "arrow", "fshape"]);

const FILL: Record<Glyph["fill"], [string, string]> = {
  solid: ["sólido", "sólida"],
  outline: ["vazado", "vazada"],
  striped: ["listrado", "listrada"],
};

const DIRECTION: Record<number, string> = {
  0: "para cima",
  45: "para cima e à direita",
  90: "para a direita",
  135: "para baixo e à direita",
  180: "para baixo",
  225: "para baixo e à esquerda",
  270: "para a esquerda",
  315: "para cima e à esquerda",
};

export function describeGlyph(g: Glyph): string {
  const fem = FEMININE.has(g.shape);
  const [sing, plural] = SHAPE[g.shape];
  const fill = FILL[g.fill][fem ? 1 : 0] + (g.count > 1 ? "s" : "");
  let text = g.count === 1 ? `${fem ? "uma" : "um"} ${sing} ${fill}` : `${g.count} ${plural} ${fill}`;
  if (g.shape === "arrow") text += g.count > 1 ? `, apontando ${DIRECTION[g.rotation]}` : ` apontando ${DIRECTION[g.rotation]}`;
  else if (g.shape === "fshape") {
    if (g.mirror) text += ", espelhada da esquerda para a direita";
    text += g.rotation ? `, girada ${g.rotation}° no sentido horário` : ", na posição original";
  } else if (g.rotation) text += `, girad${fem ? "a" : "o"} ${g.rotation}°`;
  return text;
}
