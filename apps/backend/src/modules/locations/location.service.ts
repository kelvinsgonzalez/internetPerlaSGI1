import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { WorkerLocation } from './location.entity';

@Injectable()
export class LocationService {
  constructor(
    @InjectRepository(WorkerLocation)
    private readonly locationRepository: Repository<WorkerLocation>,
  ) {}

  /**
   * Registra la ubicación actual de un usuario
   */
  async createLocation(userId: string, lat: number, lng: number): Promise<WorkerLocation> {
    const location = this.locationRepository.create({
      userId,
      lat,
      lng,
    });
    return this.locationRepository.save(location);
  }

  /**
   * Obtiene la última ubicación de todos los usuarios
   * @returns Array con última ubicación por usuario
   */
  async findLatestPerUser(): Promise<any[]> {
    // Obtener el id más reciente por usuario
    const latestLocations = await this.locationRepository
      .createQueryBuilder('loc')
      .distinctOn(['loc.userId'])
      .orderBy('loc.userId', 'ASC')
      .addOrderBy('loc.createdAt', 'DESC')
      .getMany();

    return latestLocations.map((loc) => ({
      id: loc.id,
      userId: loc.userId,
      lat: loc.lat,
      lng: loc.lng,
      createdAt: loc.createdAt,
    }));
  }

  /**
   * Obtiene ubicaciones de un usuario específico
   * @param userId ID del usuario
   * @param date Fecha opcional en formato YYYY-MM-DD para filtrar por día
   */
  async findByUserId(userId: string, date?: string): Promise<WorkerLocation[]> {
    let query = this.locationRepository
      .createQueryBuilder('loc')
      .where('loc.userId = :userId', { userId })
      .orderBy('loc.createdAt', 'DESC');

    if (date) {
      const startDate = new Date(`${date}T00:00:00Z`);
      const endDate = new Date(`${date}T23:59:59Z`);
      query = query
        .andWhere('loc.createdAt >= :startDate', { startDate })
        .andWhere('loc.createdAt <= :endDate', { endDate });
    }

    return query.getMany();
  }

  /**
   * Obtiene ubicaciones recientes de los últimos N minutos
   * @param minutes Minutos hacia atrás (default: 1440 = 24 horas)
   */
  async findRecent(minutes: number = 1440): Promise<WorkerLocation[]> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return this.locationRepository.find({
      where: {
        createdAt: MoreThan(since),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Elimina ubicaciones antiguas (limpieza de base de datos)
   * @param days Eliminar registros más antiguos que N días
   */
  async deleteOldRecords(days: number = 30): Promise<any> {
    const oldDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.locationRepository.delete({
      createdAt: MoreThan(oldDate),
    });
  }
}
