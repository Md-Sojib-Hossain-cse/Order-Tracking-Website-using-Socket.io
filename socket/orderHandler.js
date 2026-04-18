import { calculateTotal, orderIdGenerator } from "../utils/helper";

export const orderHandler = (io, socket) => {
  //   console.log(io, socket);

  //place order
  socket.on("placeOrder", async (data, callback) => {
    try {
      //   console.log("placed order from", socket.id);

      const validation = validateOrder(data);

      if (!validation.valid) {
        return callback({ success: false, message: validation.message });
      }

      //calculate total
      const total = calculateTotal(data.items);
      const orderId = orderIdGenerator();
      
    } catch (error) {
      console.log(error);
    }
  });
};
