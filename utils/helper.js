import { Timestamp } from "mongodb";

export const validateOrder = (data) => {
  if (!data.customerName?.trim()) {
    return { valid: false, message: "Customer name is Required" };
  }
  if (!data.customerPhone?.trim()) {
    return { valid: false, message: "Customer phone number is Required" };
  }
  if (!data.customerAddress?.trim()) {
    return { valid: false, message: "Customer address is Required" };
  }
  if (!Array.isArray(data.items)) {
    return { valid: false, message: "Order must have at least 1 item" };
  }

  return { valid: true };
};

//order id generator

export const orderIdGenerator = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const randomNumber = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return `ORD-${year}${month}${day}-${randomNumber}`;
};

//total calculation

export const calculateTotal = (items) => {
  const subTotal = items.reduce(
    (item, sum) => sum + item.price * item.quantity,
    0,
  );

  const tax = subTotal * 0.1;
  const deliveryFee = 35.0;

  const total = subTotal + tax + deliveryFee;

  return {
    subTotal: Math.round(subTotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    deliveryFee,
    totalAmount: Math.round(total * 100) / 100,
  };
};

export const createOrderDocument = (orderData, orderId, totals) => {
  return {
    orderId,
    customerName: orderData.customerName.trim(),
    customerPhone: orderData.customerPhone.trim(),
    customerAddress: orderData.customerAddress.trim(),
    items: orderData.items,
    subTotal: totals.subTotal,
    tax: totals.tax,
    deliveryFee: totals.deliveryFee,
    totalAmount: totals.totalAmount,
    specialNotes: orderData.specialNotes || "",
    paymentMethod: orderData.paymentMethod || "cash",
    paymentStatus: "pending",
    statusHistory: [
      {
        status: "pending",
        Timestamp: new Date(),
        by: "customer",
        note: "order placed",
      },
    ],
    estimatedTime: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

//Status transition
export const isValidStatusTransition = (currentStatus, newStatus) => {
  const validTransition = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["preparing", "cancelled"],
    preparing: ["ready", "cancelled"],
    ready: ["out_for_delivery", "cancelled"],
    out_for_delivery: ["delivered"],
    delivered: [],
    cancelled: [],
  };

  return validTransition[currentStatus]?.includes(newStatus) || false;
};
