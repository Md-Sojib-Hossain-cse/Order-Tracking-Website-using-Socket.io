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
};
