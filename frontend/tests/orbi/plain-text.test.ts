import { describe, expect, it } from "vitest";
import { plainText } from "@/shared/lib/orbi-format";

describe("plainText", () => {
  it("drops Markdown marks that the pixel bubble cannot render", () => {
    expect(plainText("Ноутбук ожидается **17.11**. Сейчас он __в пути__, забери на *IT-стойке*."))
      .toBe("Ноутбук ожидается 17.11. Сейчас он в пути, забери на IT-стойке.");
    expect(plainText("## Шаги\nОткрой PR в `develop`, см. [гайд](https://wiki/guide)."))
      .toBe("Шаги\nОткрой PR в develop, см. гайд.");
  });

  it("keeps lists and lone asterisks", () => {
    expect(plainText("* пункт\n2 * 3 = 6")).toBe("* пункт\n2 * 3 = 6");
  });
});
