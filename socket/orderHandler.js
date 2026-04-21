import { getCollection } from "../config/database.js";
import {
  calculateTotal,
  createOrderDocument,
  orderIdGenerator,
} from "../utils/helper.js";

export const orderHandler = (io, socket) => {
  //place order
  socket.on("placeOrder", async (data, callback) => {
    try {
      //   console.log("placed order from", socket.id);

      const validation = validateOrder(data);

      if (!validation.valid) {
        return callback({ success: false, message: validation.message });
      }

      //calculate total
      const totals = calculateTotal(data.items);
      const orderId = orderIdGenerator();
      const order = createOrderDocument(data, orderId, totals);

      //store into db
      const ordersCollection = getCollection("orders");
      await ordersCollection.insertOne(order);

      socket.join(`order-${orderId}`);
      socket.join("customers");

      socket.to("admins").emit("newOrder", { order });

      callback({ success: true, order });
      console.log("order created :", orderId);
    } catch (error) {
      console.log(error);
      callback({ success: false, message: "Failed to place order" });
    }
  });

  //track order
  socket.on("trackOrder", async (data, callback) => {
    try {
      const ordersCollection = await getCollection("orders");
      const order = await ordersCollection.findOne({ orderId: data.orderId });

      if (!order) {
        return callback({ success: false, message: "Order not found" });
      }

      socket.join(`order-${data.orderId}`);

      return callback({ success: true, data: order });
    } catch (error) {
      console.error("Order tracking error", error);
      callback({
        success: false,
        message: error.message || "Order tracking error",
      });
    }
  });

  //cancel order
  socket.on("cancelOrder", async (data, callback) => {
    try {
      const ordersCollection = await getCollection("orders");
      const order = await ordersCollection.findOne({ orderId: data.orderId });

      if (!order) {
        return callback({ success: false, message: "Order not found" });
      }

      if (!["pending", "confirmed"].includes(order.status)) {
        return callback({ success: false, message: "Cannot cancel the order" });
      }

      await ordersCollection.updateOne(
        { orderId: data.orderId },
        {
          $set: { status: "cancelled", updatedAt: new Date() },
          $push: {
            statusHistory: {
              status: "cancelled",
              timestamp: new Date(),
              by: socket.id,
              note: data.reason || "cancelled by customer",
            },
          },
        },
      );

      io.to(`order-${data.orderId}`).emit("orderCancelled", {
        order: data.orderId,
      });

      io.to("admins").emit("orderCancelled", {
        order: data.orderId,
        customerName: data.customerName,
      });

      callback({ success: false });
    } catch (error) {
      console.error("Cancel order error", error);
      callback({
        success: false,
        message: error.message || "Cancel order error",
      });
    }
  });

  //get my orders
  socket.on("getMyOrders", async (data, callback) => {
    try {
      const ordersCollection = await getCollection("orders");
      const orders = await ordersCollection
        .find({
          customerPhone: data.customerPhone,
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();

      callback({ success: true, orders });
    } catch (error) {
      console.error("get orders error", error);
    }
  });

  //admin events
  socket.on("adminLogin", async (data, callback) => {
    try {
      if (data.password !== process.env.password) {
        return callback({ success: false, message: "credentials not m" });
      }
    } catch (error) {
      console.log(error);
      callback({ success: false, message: "Login failed" });
    }
  });
};