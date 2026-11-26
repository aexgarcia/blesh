import { describe, expect, it } from "vitest";

import {
  cancellableBeforeDispatch,
  collectionStatus,
  completionProblems,
  computeTotals,
  fulfillmentPaymentProblem,
  normalizeRequestedLines,
  referenceFromBytes,
  refundStatus,
  termsProblem,
} from "@/modules/sales/domain/order-rules";

const base = { deliveryMode: "shipping" as const, deliveryAddress: "Av. 1", paymentMode: "prepaid" as const, requiredDepositMinor: 0, collectionResponsible: "company" as const, shippingMinor: 0 };

describe("líneas y totales", () => {
  it("une variantes repetidas y aplica límites", () => {
    expect(normalizeRequestedLines([{ variantId: "a", quantity: 2 }, { variantId: "a", quantity: 3 }])).toEqual([{ variantId: "a", quantity: 5 }]);
    expect(normalizeRequestedLines([{ variantId: "a", quantity: 6 }, { variantId: "a", quantity: 5 }])).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(normalizeRequestedLines([{ variantId: "a", quantity: 1.5 }])).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(normalizeRequestedLines([])).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("calcula subtotal − descuento + envío en céntimos", () => {
    expect(computeTotals([{ unitPriceMinor: 5000, quantity: 2 }], 500, 1000)).toEqual({ ok: true, subtotalMinor: 10000, totalMinor: 10500 });
    expect(computeTotals([{ unitPriceMinor: 5000, quantity: 1 }], 6000, 0).ok).toBe(false);
  });
});

describe("modalidades", () => {
  it("valida coherencia de entrega y adelanto", () => {
    expect(termsProblem(base, 10000)).toBeNull();
    expect(termsProblem({ ...base, paymentMode: "deposit_on_delivery", requiredDepositMinor: 0 }, 10000)?.field).toBe("deposit");
    expect(termsProblem({ ...base, paymentMode: "deposit_on_delivery", requiredDepositMinor: 3000 }, 10000)).toBeNull();
    expect(termsProblem({ ...base, requiredDepositMinor: 3000 }, 10000)?.field).toBe("deposit");
    expect(termsProblem({ ...base, deliveryMode: "pickup", shippingMinor: 500 }, 10000)?.field).toBe("shipping");
    expect(termsProblem({ ...base, collectionResponsible: "carrier" }, 10000)?.field).toBe("collectionResponsible");
  });

  it("puerta de preparación según modalidad (S/ 100, adelanto S/ 30)", () => {
    expect(fulfillmentPaymentProblem({ paymentMode: "prepaid", requiredDepositMinor: 0, totalMinor: 10000, paidMinor: 9999 })).not.toBeNull();
    expect(fulfillmentPaymentProblem({ paymentMode: "prepaid", requiredDepositMinor: 0, totalMinor: 10000, paidMinor: 10000 })).toBeNull();
    expect(fulfillmentPaymentProblem({ paymentMode: "deposit_on_delivery", requiredDepositMinor: 3000, totalMinor: 10000, paidMinor: 2999 })).not.toBeNull();
    expect(fulfillmentPaymentProblem({ paymentMode: "deposit_on_delivery", requiredDepositMinor: 3000, totalMinor: 10000, paidMinor: 3000 })).toBeNull();
    expect(fulfillmentPaymentProblem({ paymentMode: "cash_on_delivery", requiredDepositMinor: 0, totalMinor: 10000, paidMinor: 0 })).toBeNull();
  });
});

describe("estados derivados", () => {
  it("cobro y reembolso", () => {
    expect([collectionStatus(10000, 0), collectionStatus(10000, 5000), collectionStatus(10000, 10000)]).toEqual(["unpaid", "partially_paid", "paid"]);
    expect(refundStatus([])).toBe("none");
    expect(refundStatus([{ authorizedMinor: 3000, refundedMinor: 0 }])).toBe("pending");
    expect(refundStatus([{ authorizedMinor: 3000, refundedMinor: 1000 }])).toBe("partially_refunded");
    expect(refundStatus([{ authorizedMinor: 3000, refundedMinor: 3000 }])).toBe("refunded");
  });

  it("completar exige entrega, cobro íntegro y sin incidencias", () => {
    const ok = { status: "confirmed" as const, fulfillmentStatus: "delivered" as const, totalMinor: 10000, paidMinor: 10000, reportedMinor: 0, outstandingRefundMinor: 0 };
    expect(completionProblems(ok)).toEqual([]);
    expect(completionProblems({ ...ok, paidMinor: 5000 })).toHaveLength(1);
    expect(completionProblems({ ...ok, fulfillmentStatus: "dispatched", reportedMinor: 5000 })).toHaveLength(2);
  });

  it("cancelación previa al despacho", () => {
    expect(cancellableBeforeDispatch("requested", "unarranged")).toBe(true);
    expect(cancellableBeforeDispatch("confirmed", "ready")).toBe(true);
    expect(cancellableBeforeDispatch("confirmed", "dispatched")).toBe(false);
  });

  it("referencia corta sin caracteres ambiguos", () => {
    expect(referenceFromBytes(new Uint8Array([0, 1, 2, 3, 4, 29]))).toBe("BL-23456Z");
    expect(referenceFromBytes(new Uint8Array(6).fill(255))).toMatch(/^BL-[2-9A-Z]{6}$/);
  });
});
