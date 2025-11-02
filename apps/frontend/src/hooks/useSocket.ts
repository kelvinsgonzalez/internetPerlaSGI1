import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getApiOrigin } from "../services/api";
import { useAuth } from "./useAuth";

export function useSocket() {
  const { token } = useAuth();
  const sockRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      sockRef.current?.disconnect();
      sockRef.current = null;
      return;
    }
    const s = io(getApiOrigin(), {
      transports: ["websocket"],
      auth: { token },
    });
    sockRef.current = s;
    setSocket(s);
    return () => {
      s.disconnect();
      sockRef.current = null;
      setSocket(null);
    };
  }, [token]);

  return useMemo(() => ({ socket }), [socket]);
}
