import { describe, expect, it } from "vitest";

import { normalizeSku, priceProblem, publicationIssues, SKU_PATTERN, sizeOrder, type ReadinessSnapshot } from "@/modules/catalog/domain/rules";

const complete: ReadinessSnapshot = {
  title: "Boxy Essential",
  slug: "boxy-essential",
  shortDescription: "Polo boxy",
  description: "Algodón peinado.",
  categoryActive: true,
  colors: [
    { id: "negro", label: "Negro", active: true, isPrimary: true },
    { id: "blanco", label: "Blanco", active: true, isPrimary: false },
  ],
  variants: [
    { id: "n-s", colorId: "negro", active: true },
    { id: "b-s", colorId: "blanco", active: true },
  ],
  images: [
    { colorId: "negro", isCover: true, alt: "Negro frente" },
    { colorId: "blanco", isCover: true, alt: "Blanco frente" },
  ],
  variantsWithStockRecord: new Set(["n-s", "b-s"]),
};

describe("publicación", () => {
  it("un producto completo con dos colores es publicable", () => {
    expect(publicationIssues(complete)).toEqual([]);
  });

  it("exige textos, categoría y color principal", () => {
    const issues = publicationIssues({ ...complete, shortDescription: " ", categoryActive: false, colors: complete.colors.map((c) => ({ ...c, isPrimary: false })) });
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(["short_description", "category", "primary_color"]));
  });

  it("cada color activo necesita talla activa, portada con alt y stock registrado", () => {
    const issues = publicationIssues({
      ...complete,
      variants: [{ id: "n-s", colorId: "negro", active: true }, { id: "b-s", colorId: "blanco", active: false }],
      images: [{ colorId: "negro", isCover: true, alt: "" }],
      variantsWithStockRecord: new Set(),
    });
    expect(issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["alt:negro", "stock:negro", "variants:blanco", "cover:blanco"]),
    );
  });

  it("no usa fotos de otro color ni comunes como portada de un color", () => {
    const issues = publicationIssues({ ...complete, images: [{ colorId: null, isCover: true, alt: "Común" }, complete.images[0]] });
    expect(issues.map((i) => i.code)).toContain("cover:blanco");
  });

  it("un color inactivo no bloquea la publicación", () => {
    const issues = publicationIssues({
      ...complete,
      colors: [complete.colors[0], { ...complete.colors[1], active: false }],
      images: [complete.images[0]],
    });
    expect(issues).toEqual([]);
  });
});

describe("reglas de variante", () => {
  it("normaliza y valida SKU", () => {
    expect(normalizeSku(" box neg s ")).toBe("BOX-NEG-S");
    expect(SKU_PATTERN.test("BOX-NEG-S")).toBe(true);
    expect(SKU_PATTERN.test("-BOX")).toBe(false);
    expect(SKU_PATTERN.test("AB")).toBe(false);
  });

  it("precio positivo y precio anterior mayor", () => {
    expect(priceProblem(7000, null)).toBeNull();
    expect(priceProblem(7000, 9900)).toBeNull();
    expect(priceProblem(0, null)).toMatch(/mayor que 0/);
    expect(priceProblem(7000, 7000)).toMatch(/anterior/);
  });

  it("ordena tallas de forma natural", () => {
    expect(["L", "XS", "M", "S"].sort((a, b) => sizeOrder(a) - sizeOrder(b))).toEqual(["XS", "S", "M", "L"]);
  });
});
