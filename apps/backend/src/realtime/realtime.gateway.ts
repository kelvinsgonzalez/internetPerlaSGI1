import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UsersRepository } from "../repositories/users.repository";
import { isRetiredEmail } from "../common/security";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { isOriginAllowed } from "../common/cors";

type JwtPayload = { sub: string; role?: "ADMIN" | "USER"; email?: string };

@Injectable()
@WebSocketGateway({
  cors: {
    // Se resuelve por conexión (no al importar el módulo) para que respete
    // CORS_ORIGINS igual que el CORS HTTP de main.ts.
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) =>
      callback(null, isOriginAllowed(origin)),
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private jwt: JwtService,
    private cfg: ConfigService,
    private users: UsersRepository,
  ) {}

  @WebSocketServer()
  server: Server;

  // La firma válida no basta, igual que en el API HTTP: se comprueba el estado
  // actual del usuario. Si no, un token robado seguiría recibiendo los eventos
  // en tiempo real (incluidos los del canal de administradores) durante días,
  // aunque se hubiera bloqueado la cuenta o cambiado la contraseña.
  async handleConnection(client: Socket) {
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

      const user = await this.users.findById(payload.sub);
      if (!user || user.isBlocked || isRetiredEmail(user.email)) {
        client.disconnect(true);
        return;
      }
      if (user.passwordChangedAt && (payload as any).iat) {
        const changedAt = Math.floor(user.passwordChangedAt.getTime() / 1000);
        if ((payload as any).iat < changedAt - 1) {
          client.disconnect(true);
          return;
        }
      }

      // El rol sale de la base, no del token: un descenso de ADMIN a USER surte
      // efecto en la siguiente conexión y no espera a que caduque el JWT.
      (client.data as any).userId = user.id;
      (client.data as any).role = user.role;
      client.join(`user:${user.id}`);
      if (user.role === "ADMIN") client.join("role:ADMIN");
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
