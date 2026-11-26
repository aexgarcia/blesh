import { describe, expect, it } from "vitest";

import { MAX_ORDER_LINES, MAX_UNITS_PER_LINE } from "@/modules/sales/contracts";
import { acceptPrices, addToCart, cartUnits, EMPTY_CART, parseStoredCart, removeLine, serializeCart, setQuantity } from "@/modules/sales/domain/cart";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("carrito local", () => {
  it("une la misma variante y limita a 10 unidades por talla, informando el límite", () => {
    let r = addToCart(EMPTY_CART, { variantId: id(1), quantity: 4 });
    expect(r.added).toBe(4);
    r = addToCart(r.state, { variantId: id(1), quantity: 8 });
    expect(r.state.lines).toEqual([{ variantId: id(1), quantity: MAX_UNITS_PER_LINE }]);
    expect(r).toMatchObject({ added: 6, limit: "units" });
    expect(addToCart(r.state, { variantId: id(1), quantity: 1 })).toMatchObject({ added: 0, limit: "units" });
  });

  it("no admite más de 50 tallas distintas", () => {
    let state = EMPTY_CART;
    for (let i = 0; i < MAX_ORDER_LINES; i++) state = addToCart(state, { variantId: id(i), quantity: 1 }).state;
    const r = addToCart(state, { variantId: id(999), quantity: 1 });
    expect(r).toMatchObject({ added: 0, limit: "lines" });
    expect(r.state.lines).toHaveLength(MAX_ORDER_LINES);
  });

  it("ignora cantidades no enteras o no positivas", () => {
    expect(addToCart(EMPTY_CART, { variantId: id(1), quantity: 1.5 }).added).toBe(0);
    expect(addToCart(EMPTY_CART, { variantId: id(1), quantity: 0 }).added).toBe(0);
    expect(addToCart(EMPTY_CART, { variantId: id(1), quantity: -2 }).added).toBe(0);
  });

  it("cambia cantidades (máx. 10), elimina con 0 y cuenta unidades", () => {
    let state = addToCart(EMPTY_CART, { variantId: id(1), quantity: 2 }).state;
    state = addToCart(state, { variantId: id(2), quantity: 1 }).state;
    expect(cartUnits(state)).toBe(3);
    expect(setQuantity(state, id(1), 99).lines[0].quantity).toBe(MAX_UNITS_PER_LINE);
    expect(setQuantity(state, id(1), 0).lines.map((l) => l.variantId)).toEqual([id(2)]);
    expect(removeLine(state, id(2)).lines.map((l) => l.variantId)).toEqual([id(1)]);
  });

  it("guarda el precio visto como dato descartable y lo actualiza al aceptar", () => {
    const state = addToCart(EMPTY_CART, { variantId: id(1), quantity: 1, seenPriceMinor: 4000 }).state;
    expect(acceptPrices(state, new Map([[id(1), 4500]])).lines[0].seenPriceMinor).toBe(4500);
  });

  it("serializa solo ids, cantidades, precio visto y clave; se recupera igual", () => {
    const key = "11111111-1111-4111-8111-111111111111";
    const state = { ...addToCart(EMPTY_CART, { variantId: id(1), quantity: 2, seenPriceMinor: 4000 }).state, requestKey: key };
    expect(JSON.parse(serializeCart(state))).toEqual({ v: 1, lines: [{ variantId: id(1), quantity: 2, seenPriceMinor: 4000 }], requestKey: key });
    expect(parseStoredCart(serializeCart(state))).toEqual(state);
  });

  it("recupera de forma tolerante un almacenamiento corrupto o manipulado", () => {
    expect(parseStoredCart(null)).toEqual(EMPTY_CART);
    expect(parseStoredCart("{no json")).toEqual(EMPTY_CART);
    expect(parseStoredCart(JSON.stringify({ v: 99, lines: [] }))).toEqual(EMPTY_CART);
    const tampered = JSON.stringify({
      v: 1,
      lines: [
        { variantId: "no-es-uuid", quantity: 1 },
        { variantId: id(1), quantity: 2.5 },
        { variantId: id(2), quantity: 50, seenPriceMinor: -1 },
        { variantId: id(2).toUpperCase(), quantity: 3 },
        "basura",
      ],
      requestKey: "x",
    });
    expect(parseStoredCart(tampered)).toEqual({ lines: [{ variantId: id(2), quantity: MAX_UNITS_PER_LINE }] });
  });
});
