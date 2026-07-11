import { describe, expect, it } from "vitest";
import { buildServiceOrderPayload, filterSupportOrders, getNextServiceOrderStatus, getSupportMetrics } from "./technicalService";

describe("technical service unit rules", () => {
  it("builds a clean reception payload with PEN amounts and null optional fields", () => {
    const payload = buildServiceOrderPayload({
      customer_name: "Cliente Test",
      customer_phone: "",
      customer_email: "",
      device_type: "Laptop",
      device_brand: "Lenovo",
      device_model: "T14",
      accessories: "",
      reported_issue: "No enciende",
      priority: "urgent",
      estimated_cost: "120.50",
      final_cost: "",
      notes: "",
      diagnosis: "",
      received_by_id: "",
      spare_parts: "",
    });

    expect(payload).toMatchObject({
      customer_name: "Cliente Test",
      customer_phone: null,
      device_type: "Laptop",
      estimated_cost: 120.5,
      final_cost: null,
      reported_issue: "No enciende",
    });
  });

  it("keeps support status flow predictable", () => {
    expect(getNextServiceOrderStatus("pending")).toBe("in_progress");
    expect(getNextServiceOrderStatus("in_progress")).toBe("completed");
    expect(getNextServiceOrderStatus("completed")).toBe("delivered");
    expect(getNextServiceOrderStatus("delivered")).toBeNull();
  });

  it("filters all orders for general support view and mine only when requested", () => {
    const orders = [
      { order_number: 1, customer_name: "Ana", device_type: "Laptop", status: "pending", received_by_id: "u1" },
      { order_number: 2, customer_name: "Luis", device_type: "Impresora", status: "in_progress", assigned_technician_id: "u2" },
    ];

    expect(filterSupportOrders(orders, "", "all", "u1")).toHaveLength(2);
    expect(filterSupportOrders(orders, "", "mine", "u1")).toHaveLength(1);
    expect(filterSupportOrders(orders, "impresora", "all", "u1")).toHaveLength(1);
  });

  it("calculates dashboard metrics without hiding other staff orders", () => {
    const metrics = getSupportMetrics([
      { status: "pending", priority: "normal", received_by_id: "u1" },
      { status: "in_progress", priority: "urgent", assigned_technician_id: "u2" },
      { status: "completed", priority: "normal", completed_at: "2026-07-11T10:00:00Z", assigned_technician_id: "u1" },
      { status: "delivered", priority: "urgent", assigned_technician_id: "u1" },
    ], "u1", "2026-07-11");

    expect(metrics.totalActive).toBe(3);
    expect(metrics.myPending).toBe(1);
    expect(metrics.myCompleted).toBe(1);
    expect(metrics.completedToday).toBe(1);
    expect(metrics.urgent).toBe(1);
  });
});