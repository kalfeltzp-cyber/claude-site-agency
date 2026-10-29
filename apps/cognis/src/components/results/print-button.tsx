"use client";

import { Button } from "../ui/button";

export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      Imprimir / salvar PDF
    </Button>
  );
}
