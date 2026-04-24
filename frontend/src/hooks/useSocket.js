/* eslint-disable react-hooks/refs */
import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

export const useSocket = () => {
  const socketRef = useRef(null);

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    //create socket connection
    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    //connection event
    socketRef.current.on("connect", () => {
      setConnected(true);
      console.log("connected to server :", socketRef.current.id);
    });

    //disconnection event
    socketRef.current.on("disconnect", () => {
      setConnected(false);
      console.log("disconnected from server..");
    });

    socketRef.current.on("connected", (data) => {
      console.log("Server Message :", data.message);
    });

    //cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return {
    socket: socketRef.current,
    connected,
  };
};
