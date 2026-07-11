export type ServiceOrderForm = {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  device_type: string;
  device_brand: string;
  device_model: string;
  accessories: string;
  reported_issue: string;
  priority: string;
  estimated_cost: string;
  notes: string;
  diagnosis: string;
  final_cost: string;
  received_by_id: string;
  spare_parts: string;
};

export const emptyReceptionForm: ServiceOrderForm = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  device_type: "",
  device_brand: "",
  device_model: "",
  accessories: "",
  reported_issue: "",
  priority: "normal",
  estimated_cost: "",
  notes: "",
  diagnosis: "",
  final_cost: "",
  received_by_id: "",
  spare_parts: "",
};

const parseMoney = (value: string) => {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const buildServiceOrderPayload = (formData: ServiceOrderForm) => ({
  customer_name: formData.customer_name,
  customer_phone: formData.customer_phone || null,
  customer_email: formData.customer_email || null,
  device_type: formData.device_type,
  device_brand: formData.device_brand || null,
  device_model: formData.device_model || null,
  accessories: formData.accessories || null,
  reported_issue: formData.reported_issue,
  priority: formData.priority,
  estimated_cost: parseMoney(formData.estimated_cost),
  final_cost: parseMoney(formData.final_cost),
  diagnosis: formData.diagnosis || null,
  notes: formData.notes || null,
  spare_parts: formData.spare_parts || null,
});

export async function saveServiceOrder(params: {
  client: any;
  formData: ServiceOrderForm;
  userId?: string | null;
  editingId?: string | null;
}) {
  const payload: any = buildServiceOrderPayload(params.formData);

  if (params.editingId) {
    if (params.formData.received_by_id) {
      payload.received_by_id = params.formData.received_by_id;
    }
    const { error } = await params.client.from("service_orders").update(payload).eq("id", params.editingId);
    if (error) throw error;
    return { mode: "update" as const, payload };
  }

  payload.received_by_id = params.userId || null;
  const { error } = await params.client.from("service_orders").insert(payload);
  if (error) throw error;
  return { mode: "insert" as const, payload };
}

export const getNextServiceOrderStatus = (current: string): string | null => {
  const flow: Record<string, string> = {
    pending: "in_progress",
    in_progress: "completed",
    completed: "delivered",
  };
  return flow[current] || null;
};

export function filterSupportOrders(orders: any[], search: string, filterTech: string, userId?: string | null) {
  const query = search.toLowerCase().trim();
  return orders.filter((order: any) => {
    const matchSearch = !query
      || order.customer_name?.toLowerCase().includes(query)
      || order.device_type?.toLowerCase().includes(query)
      || order.device_brand?.toLowerCase().includes(query)
      || String(order.order_number).includes(query);

    const matchTech = filterTech === "all"
      ? true
      : filterTech === "mine"
        ? order.assigned_technician_id === userId || order.received_by_id === userId
        : order.assigned_technician_id === filterTech || order.received_by_id === filterTech;

    return matchSearch && matchTech;
  });
}

export function getSupportMetrics(orders: any[], userId?: string | null, todayIso = new Date().toISOString().split("T")[0]) {
  const myOrders = orders.filter((order: any) => order.assigned_technician_id === userId || order.received_by_id === userId);
  return {
    totalActive: orders.filter((order: any) => !["delivered", "cancelled"].includes(order.status)).length,
    myPending: myOrders.filter((order: any) => order.status === "pending").length,
    myInProgress: myOrders.filter((order: any) => order.status === "in_progress").length,
    myCompleted: myOrders.filter((order: any) => order.status === "completed").length,
    completedToday: orders.filter((order: any) => order.completed_at?.startsWith(todayIso)).length,
    urgent: orders.filter((order: any) => order.priority === "urgent" && !["delivered", "cancelled"].includes(order.status)).length,
  };
}