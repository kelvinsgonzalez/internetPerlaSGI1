import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CustomerConflictsRepository } from "../../repositories/customer-conflicts.repository";
import { CustomersRepository } from "../../repositories/customers.repository";
import { PlansRepository } from "../../repositories/plans.repository";
import { Customer } from "./customer.entity";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto";

@Injectable()
export class CustomersService {
  constructor(
    private repo: CustomersRepository,
    private plans: PlansRepository,
    private conflicts: CustomerConflictsRepository
  ) {}

  findAll() {
    return this.repo
      .findAll()
      .then((arr) => arr.map((c) => this.toSpanishDto(c)));
  }

  async findOne(id: string) {
    const c = await this.repo.findById(id);
    if (!c) throw new NotFoundException("Not found");
    return this.toSpanishDto(c);
  }

  async create(dto: CreateCustomerDto) {
    const entity: Partial<Customer> = {
      name: dto.nombreCompleto,
      phone: dto.telefono,
      address: dto.direccion,
      ipAsignada: dto.ipAsignada,
      latitud: dto.latitud,
      longitud: dto.longitud,
      status: dto.estadoCliente ?? "active",
      notes: dto.notas,
    };
    if (dto.planId) {
      const plan = await this.plans.findById(dto.planId);
      if (plan) entity.plan = plan;
    } else if (dto.planDeInternet) {
      const name = dto.planDeInternet.trim();
      if (name) {
        let plan = await this.plans.findByName(name);
        if (!plan) plan = await this.plans.save({ name, price: "0" });
        entity.plan = plan;
      }
    }
    const saved = await this.repo.save(entity);
    return this.toSpanishDto(saved);
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const entity = await this.repo.findById(id);
    if (!entity) throw new NotFoundException("Not found");
    Object.assign(entity, {
      name: dto.nombreCompleto ?? entity.name,
      phone: dto.telefono ?? entity.phone,
      address: dto.direccion ?? entity.address,
      ipAsignada: dto.ipAsignada ?? entity.ipAsignada,
      latitud: dto.latitud ?? entity.latitud,
      longitud: dto.longitud ?? entity.longitud,
      status: dto.estadoCliente ?? entity.status,
      notes: dto.notas ?? entity.notes,
    });
    if (dto.planId) {
      const plan = await this.plans.findById(dto.planId);
      entity.plan = plan ?? null;
    } else if (dto.planDeInternet) {
      const name = dto.planDeInternet.trim();
      if (name) {
        let plan = await this.plans.findByName(name);
        if (!plan) plan = await this.plans.save({ name, price: "0" });
        entity.plan = plan;
      }
    }
    const saved = await this.repo.save(entity);
    return this.toSpanishDto(saved);
  }

  async remove(id: string) {
    const c = await this.repo.findById(id);
    if (!c) throw new NotFoundException("Not found");
    await this.repo.remove(c as any);
    return { deleted: true };
  }

  async removeAll() {
    return this.repo.removeAll();
  }

  // Parser CSV con soporte de campos entrecomillados: una dirección como
  // "4a calle, zona 1" ya no parte la fila en dos columnas.
  private parseCsv(buffer: Buffer): { headers: string[]; rows: string[][] } {
    // BOM de Excel al inicio del archivo
    const content = buffer.toString("utf8").replace(/^﻿/, "");

    const records: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;

    const endField = () => {
      row.push(field.trim());
      field = "";
    };
    const endRow = () => {
      endField();
      if (row.some((c) => c.length > 0)) records.push(row);
      row = [];
    };

    for (let i = 0; i < content.length; i++) {
      const ch = content[i];

      if (inQuotes) {
        if (ch === '"') {
          if (content[i + 1] === '"') {
            field += '"'; // comilla escapada ("")
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
        continue;
      }

      if (ch === '"') inQuotes = true;
      else if (ch === ",") endField();
      else if (ch === "\r") continue;
      else if (ch === "\n") endRow();
      else field += ch;
    }
    endRow(); // última línea sin salto final

    if (records.length === 0) return { headers: [], rows: [] };
    const headers = records[0].map((h) => h.toLowerCase());
    return { headers, rows: records.slice(1) };
  }

  // Import customers from CSV; detects duplicates by name+address and logs conflicts.
  // mode='replace' wipes all existing customers (and dependent tasks) before importing.
  async importCsv(
    file: Express.Multer.File,
    mode: "append" | "replace" = "append"
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'Falta el archivo CSV (campo "file") o está vacío.'
      );
    }
    let wiped = { tasks: 0, customers: 0 };
    if (mode === "replace") {
      wiped = await this.repo.removeAll();
    }
    const { headers, rows } = this.parseCsv(file.buffer);
    const idx = (name: string) => headers.indexOf(name);
    const ipIdx = (() => {
      const ip = idx("ip");
      if (ip !== -1) return ip;
      const ipAsg = idx("ipasignada");
      if (ipAsg !== -1) return ipAsg;
      const ipAsgUnd = idx("ip_asignada");
      return ipAsgUnd;
    })();
    const nameIdx = idx("name") !== -1 ? idx("name") : idx("nombre");
    const addressIdx =
      idx("address") !== -1 ? idx("address") : idx("direccion");
    const phoneIdx = idx("phone") !== -1 ? idx("phone") : idx("telefono");
    const latIdx = idx("latitud");
    const lngIdx = idx("longitud");
    const planIdx = (() => {
      const p = idx("plan");
      if (p !== -1) return p;
      const p2 = idx("plandeinternet");
      if (p2 !== -1) return p2;
      const p3 = idx("plan_de_internet");
      return p3;
    })();
    const notesIdx = idx("notes") !== -1 ? idx("notes") : idx("notas");

    if (nameIdx === -1) {
      throw new BadRequestException(
        'CSV debe incluir columna "name" o "nombre"'
      );
    }

    const seenKeys = new Set<string>();
    let inserted = 0;
    let conflicts = 0;

    for (const r of rows) {
      const ipAsignada = ipIdx !== -1 ? (r[ipIdx] || "").trim() : "";
      const name = (nameIdx !== -1 ? r[nameIdx] || "" : "").trim();
      const address = (addressIdx !== -1 ? r[addressIdx] || "" : "").trim();
      const latitud = latIdx !== -1 ? (r[latIdx] || "").trim() : "";
      const longitud = lngIdx !== -1 ? (r[lngIdx] || "").trim() : "";
      const key = `${name.toLowerCase()}|${(address || "").toLowerCase()}`;

      if (!name) {
        await this.conflicts.save({
          name,
          address,
          phone: phoneIdx !== -1 ? r[phoneIdx] : undefined,
          ipAsignada,
          latitud: latitud || null,
          longitud: longitud || null,
          planName: planIdx !== -1 ? r[planIdx] : undefined,
          reason: "Falta nombre",
          rowData: r,
        });
        conflicts++;
        continue;
      }

      if (seenKeys.has(key)) {
        await this.conflicts.save({
          name,
          address,
          phone: phoneIdx !== -1 ? r[phoneIdx] : undefined,
          ipAsignada,
          latitud: latitud || null,
          longitud: longitud || null,
          planName: planIdx !== -1 ? r[planIdx] : undefined,
          reason: "Duplicado en archivo (name+address)",
          rowData: r,
        });
        conflicts++;
        continue;
      }
      seenKeys.add(key);

      const existing = await this.repo.findByNameAndAddress(name, address);
      if (existing) {
        await this.conflicts.save({
          name,
          address,
          phone: phoneIdx !== -1 ? r[phoneIdx] : undefined,
          ipAsignada,
          latitud: latitud || null,
          longitud: longitud || null,
          planName: planIdx !== -1 ? r[planIdx] : undefined,
          reason: "Duplicado en base de datos (name+address)",
          rowData: r,
        });
        conflicts++;
        continue;
      }

      let planEntity = null;
      const planName = planIdx !== -1 ? (r[planIdx] || "").trim() : "";
      if (planName) {
        planEntity = await this.plans.findByName(planName);
        if (!planEntity) {
          // auto-create plan if missing
          planEntity = await this.plans.save({
            name: planName,
            price: "0",
            speed: undefined,
          });
        }
      }

      const toSave: Partial<Customer> = {
        name,
        address,
        ipAsignada: ipAsignada || undefined,
        latitud: latitud || undefined,
        longitud: longitud || undefined,
        phone:
          phoneIdx !== -1 ? (r[phoneIdx] || "").trim() || undefined : undefined,
        plan: planEntity || undefined,
        notes:
          notesIdx !== -1 ? (r[notesIdx] || "").trim() || undefined : undefined,
        status: "active",
      };
      await this.repo.save(toSave);
      inserted++;
    }

    return { inserted, conflicts, mode, wiped };
  }

  async listConflicts() {
    return this.conflicts.findAll();
  }

  private toSpanishDto(c: Customer) {
    return {
      id: c.id,
      nombreCompleto: c.name,
      telefono: c.phone ?? undefined,
      direccion: c.address ?? undefined,
      ipAsignada: c.ipAsignada ?? undefined,
      latitud: (c.latitud as any) ?? undefined,
      longitud: (c.longitud as any) ?? undefined,
      estadoCliente: c.status,
      notas: (c.notes as any) ?? undefined,
      plan: c.plan ?? null,
      planDeInternet: c.plan?.name,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    } as any;
  }
}
