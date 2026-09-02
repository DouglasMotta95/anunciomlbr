import { describe, expect, test } from "bun:test";

import { mapMlListingStatus } from "../src/lib/ml.server";

describe("mapMlListingStatus", () => {
  test("preserva os status reais suportados do Mercado Livre", () => {
    expect(mapMlListingStatus("active")).toBe("active");
    expect(mapMlListingStatus("paused")).toBe("paused");
    expect(mapMlListingStatus("closed")).toBe("closed");
    expect(mapMlListingStatus("under_review")).toBe("under_review");
    expect(mapMlListingStatus("inactive")).toBe("inactive");
  });

  test("status desconhecido de item publicado nunca vira draft", () => {
    expect(mapMlListingStatus("not_yet_active")).toBe("inactive");
    expect(mapMlListingStatus(null)).toBe("inactive");
    expect(mapMlListingStatus(undefined)).toBe("inactive");
  });
});
