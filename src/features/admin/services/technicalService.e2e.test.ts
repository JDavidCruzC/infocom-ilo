import { describe, expect, it } from "vitest";
import { emptyReceptionForm, filterSupportOrders, getNextServiceOrderStatus, saveServiceOrder } from "./technicalService";

describe("technical reception to support end-to-end flow", () => {
  it("lets a terminal user create a reception and then see/progress it in support", async () => {
    const storedOrders: any[] = [];
    const client = {
      from: () => ({
        insert: async (payload: any) => {
          storedOrders.push({ id: "order-1", order_number: 1001, status: "pending", ...payload });
          return { error: null };
        },
        update: (payload: any) => ({
          eq: async (_field: string, value: string) => {
            const order = storedOrders.find((item) => item.id === value);
            Object.assign(order, payload);
            return { error: null };
          },
        }),
      }),
    };

    await saveServiceOrder({
      client,
      userId: "terminal-user",
      formData: {
        ...emptyReceptionForm,
        customer_name: "Cliente Flujo",
        device_type: "Laptop",
        device_brand: "HP",
        reported_issue: "No enciende",
      },
    });

    expect(filterSupportOrders(storedOrders, "", "all", "designer-user")).toHaveLength(1);
    expect(filterSupportOrders(storedOrders, "cliente flujo", "all", "designer-user")).toHaveLength(1);

    const nextStatus = getNextServiceOrderStatus(storedOrders[0].status);
    expect(nextStatus).toBe("in_progress");

    await client.from().update({ status: nextStatus, assigned_technician_id: "designer-user" }).eq("id", "order-1");
    expect(filterSupportOrders(storedOrders, "", "mine", "designer-user")[0].status).toBe("in_progress");
  });
});