import { getCollection } from "../config/database.js";
import {
  calculateTotal,
  createOrderDocument,
  isValidStatusTransition,
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
      if (data.password !== process.env.ADMIN_PASSWORD) {
        return callback({ success: false, message: "Wrong Credentials" });
      }

      socket.isAdmin = true;
      socket.join("admins");
      console.log("admin logged in :", socket.id);

      callback({ success: true });
    } catch (error) {
      console.log(error);
      callback({ success: false, message: "Login failed" });
    }
  });

  //get all orders
  socket.on("getAllOrders", async (data, callback) => {
    try {
      if (!socket.isAdmin) {
        callback({ success: false, message: "unauthorized access" });
      }
      const ordersCollection = await getCollection("orders");
      const filter = data?.status ? { status: data?.status } : {};

      const orders = await ordersCollection
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();

      callback({ success: true, orders });
    } catch (error) {
      console.error("get orders error", error);
      callback({ success: false, message: "failed to load orders" });
    }
  });

  //update order status
  socket.on("updateOrderStatus", async (data, callback) => {
    try {
      const ordersCollection = await getCollection("orders");
      const order = await ordersCollection.findOne({ orderId: data.orderId });

      if (!order) {
        return callback({ success: false, message: "Order not found" });
      }

      if (!isValidStatusTransition(order.status, data.newStatus)) {
        return callback({
          success: false,
          message: "Invalid Status Transition",
        });
      }

      const result = await ordersCollection.findOneAndUpdate(
        {
          orderId: data.orderId,
        },
        {
          $set: {
            status: data.newStatus,
            updatedAt: new Date(),
          },
          $push: {
            statusHistory: {
              status: data.newStatus,
              timestamp: new Date(),
              by: socket.id,
              note: "Status updated by admin",
            },
          },
        },
        {
          returnDocument: "after",
        },
      );

      io.to(`order-${data.orderId}`).emit("statusUpdated", {
        orderId: data.orderId,
        status: data.newStatus,
        order: result,
      });

      socket.to("admin").emit("orderStatusChanged", {
        orderId: data.orderId,
        status: data.status,
      });

      callback({ status: true, order: result });
    } catch (error) {
      callback({ success: false, message: "Failed to update order status" });
    }
  });

  //accept order
  socket.on("acceptOrder", async (data, callback) => {
    try {
      if (!socket.isAdmin) {
        return callback({ success: false, message: "unauthorized" });
      }

      const ordersCollection = await getCollection("orders");
      const order = await ordersCollection.findOne({ orderId: data.orderId });

      if (!order || order.status !== "pending") {
        return callback({ success: false, message: "cannot accept order" });
      }

      const estimatedTime = data?.estimatedTime || "30";

      const result = await ordersCollection.findOneAndUpdate(
        { orderId: data.orderId },
        {
          $set: {
            status: "confirmed",
            estimatedTime,
            updatedAt: new Date(),
          },
          $push: {
            statusHistory: {
              status: "confirmed",
              updatedAt: new Date(),
              by: socket.id,
              note: `Accepted with ${estimatedTime}min estimated time.`,
            },
          },
        },
        {
          returnDocument: "after",
        },
      );

      io.to(`order-${data.orderId}`).emit("orderAccepted", {
        orderId: data.orderId,
        estimatedTime,
      });

      socket
        .to("admin")
        .emit("orderAcceptedByAdmin", { orderId: data.orderId });

      callback({ success: true, order: result });
    } catch (error) {
      console.error(error);
      callback({ success: false, message: error.message });
    }
  });

  //reject order
  socket.on("rejectOrder", (data, callback) => {
    try {
      if (!socket.isAdmin) {
        return callback({ success: false, message: "unauthorized" });
      }

      const ordersCollection = await getCollection("orders");
      const order = await ordersCollection.findOne({ orderId: data.orderId });

      if (!order || order.status !== "pending") {
        return callback({ success: false, message: "cannot accept order" });
      }

      const result = await ordersCollection.findOneAndUpdate(
        { orderId: data.orderId },
        {
          $set: {
            status: "cancelled",
            updatedAt: new Date(),
          },
          $push: {
            statusHistory: {
              status: "cancelled",
              updatedAt: new Date(),
              by: socket.id,
              note: `Cancelled by admin.`,
            },
          },
        },
        {
          returnDocument: "after",
        },
      );

      io.to(`order-${data.orderId}`).emit("orderRejected", {
        orderId: data.orderId,
        reason : data.reason
      });

      socket
        .to("admin")
        .emit("orderRejectedByAdmin", { orderId: data.orderId });

      callback({ success: true, order: result });
    } catch (error) {
      console.error(error);
      return callback({ status: false, message: error.message || "Failed to reject order"});
    }
  });

  //get live stats 
  socket.on("getLiveStats" , (data , callback) => {
    try{
      if (!socket.isAdmin) {
        return callback({ success: false, message: "unauthorized" });
      }

      const ordersCollection = await getCollection("orders");

      const today = new Date();
      today.setHours(0,0,0,0)

      const stats = {
        totalToday : await ordersCollection.countDocuments({createdAt : {
          $gte : {
            today
          }
        }}),
        pending : await ordersCollection.countDocuments({
          status : "pending"
        }),
        confirmed : await ordersCollection.countDocuments({
          status : "confirmed"
        }),
        preparing : await ordersCollection.countDocuments({
          status : "preparing"
        }),
        ready : await ordersCollection.countDocuments({
          status : "ready"
        }),
        outForDelivery : await ordersCollection.countDocuments({
          status : "out_for_delivery"
        }),
        delivered : await ordersCollection.countDocuments({
          status : "delivered"
        }),
        cancelled : await ordersCollection.countDocuments({
          status : "cancelled"
        }),
      }

      return callback({success : true , stats})
    } catch (error) {
      console.error(error);
      return callback({ status: false, message: error.message || "Failed to reject order"});
    }
  })
};
