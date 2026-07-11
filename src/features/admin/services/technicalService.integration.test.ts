import { describe, expect, it, vi } from "vitest";
import { emptyReceptionForm, saveServiceOrder } from "./technicalService";

const createMockClient = (result: { error: any } = { error: null }) => {
  const eq = vi.fn().mockResolvedValue(result);
  const update = vi.fn(() => ({ eq }));
  const insert = vi.fn().mockResolvedValue(result);
  const from = vi.fn(() => ({ insert, update }));
  return { client: { from }, from, insert, update, eq };
};

describe("technical service integration with database client", () => {
  it("registers a reception order for the signed-in terminal user", async () => {
    const mock = createMockClient();
    const result = await saveServiceOrder({
      client: mock.client,
      userId: "terminal-user",
      formData: {
        ...emptyReceptionForm,
        customer_name: "Cliente Terminal",
        device_type: "PC",
        reported_issue: "Lento",
        estimated_cost: "80",
      },
    });

    expect(result.mode).toBe("insert");
    expect(mock.from).toHaveBeenCalledWith("service_orders");
    expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({
      received_by_id: "terminal-user",
      customer_name: "Cliente Terminal",
      estimated_cost: 80,
    }));
  });

  it("updates an existing reception and preserves explicit received_by_id", async () => {
    const mock = createMockClient();
    const result = await saveServiceOrder({
      client: mock.client,
      userId: "editor-user",
      editingId: "order-1",
      formData: {
        ...emptyReceptionForm,
        customer_name: "Cliente Editado",
        device_type: "Laptop",
        reported_issue: "Pantalla rota",
        received_by_id: "recepcionista",
      },
    });

    expect(result.mode).toBe("update");
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ received_by_id: "recepcionista" }));
    expect(mock.eq).toHaveBeenCalledWith("id", "order-1");
  });

  it("throws database errors so the UI can show the real save failure", async () => {
    const mock = createMockClient({ error: new Error("permission denied") });

    await expect(saveServiceOrder({
      client: mock.client,
      userId: "terminal-user",
      formData: {
        ...emptyReceptionForm,
        customer_name: "Cliente Error",
        device_type: "Laptop",
        reported_issue: "No carga",
      },
    })).rejects.toThrow("permission denied");
  });
});