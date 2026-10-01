import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RealtimeGateway } from "../../realtime/realtime.gateway";
import { User } from "../users/user.entity";
import { AppRelease } from "./app-release.entity";
import { CreateReleaseDto, UpdateReleaseDto } from "./dto";

const normalizeVersion = (v: string) => v.trim().replace(/^v/i, "");

@Injectable()
export class ReleasesService {
  constructor(
    @InjectRepository(AppRelease) private readonly repo: Repository<AppRelease>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly realtime: RealtimeGateway
  ) {}

  /**
   * Novedades visibles para el usuario (las dirigidas a su rol o a todos),
   * marcando cuáles no ha leído. Las programadas a futuro no se muestran.
   *
   * Un usuario que nunca abrió las novedades sólo ve como pendiente la más
   * reciente: no tiene sentido recibir de golpe todo el historial.
   */
  async forUser(userId: string, role: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    const items = await this.repo
      .createQueryBuilder("r")
      .where("r.publishedAt <= now()")
      .andWhere("(cardinality(r.audience) = 0 OR :role = ANY(r.audience))", { role })
      .orderBy("r.publishedAt", "DESC")
      .take(100)
      .getMany();

    const seenAt = user?.releasesSeenAt ?? null;
    const withFlag = items.map((r, i) => ({
      ...r,
      unread: seenAt ? r.publishedAt > seenAt : i === 0,
    }));
    return {
      items: withFlag,
      unreadCount: withFlag.filter((r) => r.unread).length,
      latestVersion: items[0]?.version ?? null,
      seenAt,
    };
  }

  async markSeen(userId: string) {
    const now = new Date();
    await this.users.update({ id: userId }, { releasesSeenAt: now });
    return { seenAt: now };
  }

  /** Listado completo para el ADMIN (todas las audiencias y programadas). */
  listAll() {
    return this.repo.find({ order: { publishedAt: "DESC" } });
  }

  private async assertVersionFree(version: string, exceptId?: string) {
    const existing = await this.repo.findOne({ where: { version } });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(`Ya existe la versión ${version}`);
    }
  }

  async create(dto: CreateReleaseDto, author?: string) {
    const version = normalizeVersion(dto.version);
    await this.assertVersionFree(version);
    const saved = await this.repo.save(
      this.repo.create({
        version,
        title: dto.title.trim(),
        notes: dto.notes.trim(),
        audience: dto.audience ?? [],
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
        createdBy: author ?? null,
      })
    );
    this.notify(saved);
    return saved;
  }

  async update(id: string, dto: UpdateReleaseDto) {
    const release = await this.repo.findOne({ where: { id } });
    if (!release) throw new NotFoundException("Versión no encontrada");
    if (dto.version !== undefined) {
      const version = normalizeVersion(dto.version);
      await this.assertVersionFree(version, id);
      release.version = version;
    }
    if (dto.title !== undefined) release.title = dto.title.trim();
    if (dto.notes !== undefined) release.notes = dto.notes.trim();
    if (dto.audience !== undefined) release.audience = dto.audience;
    if (dto.publishedAt !== undefined) release.publishedAt = new Date(dto.publishedAt);
    const saved = await this.repo.save(release);
    this.notify(saved);
    return saved;
  }

  async remove(id: string) {
    const res = await this.repo.delete({ id });
    if (!res.affected) throw new NotFoundException("Versión no encontrada");
    return { id };
  }

  /** Aviso en vivo para que los usuarios conectados vean la novedad sin recargar. */
  private notify(release: AppRelease) {
    if (release.publishedAt.getTime() > Date.now()) return;
    this.realtime.broadcastAll("release:published", {
      id: release.id,
      version: release.version,
      title: release.title,
    });
  }
}
