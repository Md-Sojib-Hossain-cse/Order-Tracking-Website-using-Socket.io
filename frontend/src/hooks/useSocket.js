import { useRef, useState } from "react";
import io from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

const useSocket = () => {
  const socketRef = useRef(null);

  const [connected, setConnected] = useState(false);
};
