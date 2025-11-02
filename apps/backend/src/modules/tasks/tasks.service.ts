import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RealtimeGateway } from "../../realtime/realtime.gateway";
import { Customer } from "../customers/customer.entity";
import { User } from "../users/user.entity";
import { CreateTaskDto, UpdateTaskDto } from "./dto";
import { Task } from "./task.entity";

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private tasks: Repository<Task>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Customer) private customers: Repository<Customer>,
    private rt: RealtimeGateway
  ) {}

  async create(dto: CreateTaskDto, createdById: string) {
    if (!dto.telefonoContacto || !dto.telefonoContacto.trim()) {
      throw new BadRequestException("El teléfono de contacto es obligatorio");
    }
    const [assignedTo, customer, createdBy] = await Promise.all([
      this.users.findOne({ where: { id: dto.assignedToId } }),
      this.customers.findOne({ where: { id: dto.customerId } }),
      this.users.findOne({ where: { id: createdById } }),
    ]);
    if (!assignedTo) throw new NotFoundException("Trabajador no encontrado");
    if (!customer) throw new NotFoundException("Cliente no encontrado");
    if (!createdBy)
      throw new NotFoundException("Usuario creador no encontrado");

    const saved = await this.tasks.save(
      this.tasks.create({
        title: dto.title,
        description: dto.description || "",
        customer,
        assignedTo,
        createdBy,
        telefonoContacto: dto.telefonoContacto.trim(),
        status: "PENDIENTE",
      })
    );

    this.rt.emitToUser(assignedTo.id, "task:created", saved);
    this.rt.broadcastToAdmins("task:created", saved);
    this.rt.broadcastAll("tasks:update", saved);
    return saved;
  }

  async listAll(filters?: {
    status?: string;
    assignedToId?: string;
    customerId?: string;
  }) {
    const qb = this.tasks
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.customer", "customer")
      .addSelect(["customer.ipAsignada", "customer.latitud", "customer.longitud"])
      .leftJoinAndSelect("t.assignedTo", "assignedTo")
      .leftJoinAndSelect("t.createdBy", "createdBy")
      .orderBy("t.createdAt", "DESC");

    if (filters?.status)
      qb.andWhere("t.status = :status", { status: filters.status });
    if (filters?.assignedToId)
      qb.andWhere("assignedTo.id = :aid", { aid: filters.assignedToId });
    if (filters?.customerId)
      qb.andWhere("customer.id = :cid", { cid: filters.customerId });

    const tasks = await qb.getMany();
    return tasks.map((t) => this.toSpanishTask(t));
  }

  listForUser(
    userId: string,
    filters?: { status?: string; customerId?: string }
  ) {
    const qb = this.tasks
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.customer", "customer")
      .addSelect(["customer.ipAsignada", "customer.latitud", "customer.longitud"])
      .leftJoinAndSelect("t.assignedTo", "assignedTo")
      .leftJoinAndSelect("t.createdBy", "createdBy")
      .where("assignedTo.id = :uid", { uid: userId })
      .orderBy("t.createdAt", "DESC");

    if (filters?.status)
      qb.andWhere("t.status = :status", { status: filters.status });
    if (filters?.customerId)
      qb.andWhere("customer.id = :cid", { cid: filters.customerId });

    return qb.getMany().then((arr) => arr.map((t) => this.toSpanishTask(t)));
  }

  async complete(id: string, userId: string, proofUrl: string) {
    const t = await this.tasks.findOne({ where: { id } });
    if (!t) throw new NotFoundException("Task not found");
    if (t.assignedTo?.id !== userId)
      throw new ForbiddenException("Not your task");
    t.status = "COMPLETADA";
    t.completedAt = new Date();
    t.proofUrl = proofUrl;
    const saved = await this.tasks.save(t);
    if (t.assignedTo?.id)
      this.rt.emitToUser(t.assignedTo.id, "task:updated", saved);
    this.rt.broadcastToAdmins("task:updated", saved);
    this.rt.broadcastAll("tasks:update", saved);
    return saved;
  }

  async update(
    id: string,
    actor: { id: string; role: "ADMIN" | "USER" },
    dto: UpdateTaskDto
  ) {
    const task = await this.tasks.findOne({ where: { id } });
    if (!task) throw new NotFoundException("Tarea no encontrada");

    if (actor.role === "USER") {
      if (task.assignedTo?.id !== actor.id)
        throw new ForbiddenException("No autorizado");
      if (dto.status) {
        const next = this.normalizeStatus(dto.status);
        if (next === "OBJETADA") {
          if (!dto.motivoObjecion || !dto.motivoObjecion.trim()) {
            throw new ForbiddenException(
              "motivoObjecion es requerido para objetar"
            );
          }
          task.motivoObjecion = dto.motivoObjecion.trim();
        }
        if (next === "COMPLETADA") {
          if (!dto.comentarioFinal || !dto.comentarioFinal.trim()) {
            throw new ForbiddenException(
              "comentarioFinal es requerido para completar"
            );
          }
          task.comentarioFinal = dto.comentarioFinal.trim();
        } else if (dto.comentarioFinal) {
          throw new ForbiddenException(
            "comentarioFinal solo se permite cuando status es COMPLETADA"
          );
        }
        if (task.status === "OBJETADA" && next === "PENDIENTE") {
          throw new ForbiddenException(
            "No se puede regresar a PENDIENTE una tarea objetada"
          );
        }
        task.status = next;
      }
      if (dto.description !== undefined) task.description = dto.description;
    } else {
      if (dto.status) {
        if (
          task.status === "OBJETADA" &&
          (!dto.assignedToId || dto.assignedToId === task.assignedTo?.id)
        ) {
          throw new ForbiddenException(
            "No se puede modificar una tarea objetada sin reasignar o eliminar"
          );
        }
        const next = this.normalizeStatus(dto.status);
        if (next === "COMPLETADA") {
          if (!dto.comentarioFinal || !dto.comentarioFinal.trim()) {
            throw new ForbiddenException(
              "comentarioFinal es requerido para completar"
            );
          }
          task.comentarioFinal = dto.comentarioFinal.trim();
        } else if (dto.comentarioFinal) {
          throw new ForbiddenException(
            "comentarioFinal solo se permite cuando status es COMPLETADA"
          );
        }
        task.status = next;
      }
      if (dto.description !== undefined) task.description = dto.description;
      if (dto.telefonoContacto !== undefined) {
        task.telefonoContacto = (dto.telefonoContacto || "").trim();
        if (!task.telefonoContacto) {
          throw new BadRequestException(
            "El teléfono de contacto es obligatorio"
          );
        }
      }
      if (dto.assignedToId) {
        const user = await this.users.findOne({
          where: { id: dto.assignedToId },
        });
        if (!user) throw new NotFoundException("Trabajador no encontrado");
        task.assignedTo = user;
        if (task.status === "OBJETADA") {
          task.status = "PENDIENTE";
          task.motivoObjecion = null as any;
        }
      }
    }

    const saved = await this.tasks.save(task);
    if (saved.assignedTo?.id)
      this.rt.emitToUser(saved.assignedTo.id, "task:updated", saved);
    this.rt.broadcastToAdmins("task:updated", saved);
    this.rt.broadcastAll("tasks:update", saved);
    return saved;
  }

  async remove(id: string) {
    const found = await this.tasks.findOne({ where: { id } });
    if (!found) throw new NotFoundException("Tarea no encontrada");
    await this.tasks.delete(id);
    this.rt.broadcastToAdmins("task:updated", { id, deleted: true });
    this.rt.broadcastAll("tasks:update", { id, deleted: true });
    return { id };
  }

  private normalizeStatus(
    s: string
  ): "PENDIENTE" | "EN_PROCESO" | "COMPLETADA" | "OBJETADA" {
    if (s === "PENDING") return "PENDIENTE";
    if (s === "COMPLETED") return "COMPLETADA";
    return s as any as "PENDIENTE" | "EN_PROCESO" | "COMPLETADA" | "OBJETADA";
  }

  private toSpanishTask(t: Task) {
    const c = t.customer as any;
    const customer = c
      ? {
          id: c.id,
          nombreCompleto: c.nombreCompleto || c.name,
          direccion: c.direccion || c.address || null,
          telefono: c.telefono || c.phone || null,
          ipAsignada: c.ipAsignada ?? null,
          latitud: c.latitud ?? null,
          longitud: c.longitud ?? null,
        }
      : null;

    const assignedTo = t.assignedTo
      ? {
          id: t.assignedTo.id,
          name: (t.assignedTo as any).name,
          email: (t.assignedTo as any).email,
          role: (t.assignedTo as any).role,
        }
      : null;

    const createdBy = t.createdBy
      ? {
          id: t.createdBy.id,
          name: (t.createdBy as any).name,
          email: (t.createdBy as any).email,
          role: (t.createdBy as any).role,
        }
      : null;

    return {
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      telefonoContacto: t.telefonoContacto,
      customer,
      assignedTo,
      createdBy,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      motivoObjecion: (t as any).motivoObjecion ?? null,
      comentarioFinal: (t as any).comentarioFinal ?? null,
      completedAt: (t as any).completedAt ?? null,
      proofUrl: (t as any).proofUrl ?? null,
    } as any;
  }
}
