import { describe, expect, test } from "bun:test";

import { applyCandidateOrder } from "../src/lib/ml-gemini-search.server";

describe("applyCandidateOrder", () => {
  test("reordena somente candidatos existentes", () => {
    const candidates = ["A", "B", "C"];
    expect(applyCandidateOrder(candidates, [2, 0, 1], 3)).toEqual(["C", "A", "B"]);
  });

  test("descarta índices inexistentes, repetidos e valores produzidos pelo modelo", () => {
    const candidates = ["A", "B", "C"];
    const modelOutput = [99, 1, 1, -1, "MLB1234567890", "https://produto.mercadolivre.com.br/MLB-9999999999"];
    expect(applyCandidateOrder(candidates, modelOutput, 3)).toEqual(["B", "A", "C"]);
  });

  test("não cria candidato mesmo quando o modelo devolve somente lixo", () => {
    const candidates = [{ id: "MLB1111111111" }, { id: "MLB2222222222" }];
    const result = applyCandidateOrder(candidates, [500, "MLB9999999999", { url: "fake" }], 10);
    expect(result).toEqual(candidates);
    expect(result).toHaveLength(2);
  });
});
