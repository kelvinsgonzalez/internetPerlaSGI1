import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { Observable, catchError, tap, throwError } from "rxjs";
import { AuditService } from "./audit.service";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const ACTION_BY_METHOD: Record<string, string> = {
  POST: "CREAR",
  PUT: "ACTUALIZAR",
  PATCH: "ACTUALIZAR",
  DELETE: "ELIMINAR",
};

/**
 * Rutas que no se registran:
 * - auth/login: lo registra AuthController con el resultado real (y el correo
 *   intentado, que aquí no se conoce porque no hay usuario autenticado).
 * - users/update-location: el GPS reporta cada pocos segundos; llenaría la
 *   bitácora sin aportar nada.
 * - releases/seen: marcar novedades como leídas no cambia datos de negocio.
 */
const SKIP = [/^auth\/login$/, /^users\/update-location$/, /^releases\/seen$/];

export function routeOf(req: Request) {
  const raw = (req.originalUrl || req.url || "").split("?")[0];
  const path = raw.replace(/^\/?api\/v1\/?/, "").replace(/^\/+/, "");
  const module = path.split("/")[0] || "root";
  return { path, module };
}

export function clientInfo(req: Request) {
  return {
    ip: req.ip ?? null,
    userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
  };
}

/**
 * Registra en la bitácora toda petición que modifica datos, en cualquier
 * módulo, sin tener que tocar cada controlador. Se ejecuta después de los
 * guards, así que `req.user` ya está resuelto con el estado actual del usuario.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== "http") return next.handle();
    const req = ctx.switchToHttp().getRequest<Request & { user?: any; file?: any; files?: any }>();
    const method = req.method.toUpperCase();
    if (!WRITE_METHODS.has(method)) return next.handle();

    const { path, module } = routeOf(req);
    if (SKIP.some((re) => re.test(path))) return next.handle();

    const u = req.user;
    const actor = u
      ? { userId: u.userId, email: u.email, name: u.name, role: u.role }
      : null;
    const details: Record<string, unknown> = { ...(req.body ?? {}) };
    const files = [req.file, ...(Array.isArray(req.files) ? req.files : Object.values(req.files ?? {}).flat())]
      .filter(Boolean)
      .map((f: any) => f.originalname);
    if (files.length) details._archivos = files;

    const base = {
      actor,
      action: ACTION_BY_METHOD[method],
      module,
      method,
      path,
      ...clientInfo(req),
      details,
    };

    return next.handle().pipe(
      tap((result: any) => {
        const res = ctx.switchToHttp().getResponse();
        const entityId = req.params?.id ?? (result && typeof result === "object" ? result.id : undefined);
        void this.audit.record({
          ...base,
          entityId: entityId ?? null,
          statusCode: res?.statusCode ?? null,
          success: true,
        });
      }),
      catchError((err) => {
        const status = err instanceof HttpException ? err.getStatus() : 500;
        const response = err instanceof HttpException ? (err.getResponse() as any) : null;
        const message = Array.isArray(response?.message)
          ? response.message.join("; ")
          : response?.message ?? err?.message ?? "Error";
        void this.audit.record({
          ...base,
          entityId: req.params?.id ?? null,
          statusCode: status,
          success: false,
          error: String(message),
        });
        return throwError(() => err);
      })
    );
  }
}
