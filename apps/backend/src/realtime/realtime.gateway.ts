import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

type JwtPayload = { sub: string; role?: "ADMIN" | "USER"; email?: string };

// 👇 MISMO LISTADO QUE EN main.ts
const allowedOrigins = [
  "http://localhost:5173",
  "https://iperla.netlify.app",
];

@Injectable()
@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private jwt: JwtService, private cfg: ConfigService) {}

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as any)?.token ||
        (client.handshake.query as any)?.token;
      if (!token || typeof token !== "string") {
        client.disconnect(true);
        return;
      }
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.cfg.get<string>("JWT_SECRET"),
      });
      (client.data as any).userId = payload.sub;
      (client.data as any).role = payload.role;
      client.join(`user:${payload.sub}`);
      if (payload.role === "ADMIN") client.join("role:ADMIN");
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    // no-op
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }

  broadcastToAdmins(event: string, data: any) {
    this.server?.to("role:ADMIN").emit(event, data);
  }

  broadcastAll(event: string, data: any) {
    this.server?.emit(event, data);
  }

  public handleLocationUpdate(workerId: string, lat: number, lng: number) {
    console.log(
      `Broadcasting location update for worker ${workerId}: ${lat}, ${lng}`,
    );
    this.broadcastToAdmins("worker-location-updated", {
      workerId,
      lat,
      lng,
    });
  }
}
