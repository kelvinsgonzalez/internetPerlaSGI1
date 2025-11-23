import { Controller, Post, Get, Body, Param, Query, Request } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LocationService } from './location.service';
import { RolesGuard } from 'src/modules/auth/roles.guard';
import { Roles } from 'src/modules/auth/roles.decorator';
import { Role } from 'src/modules/users/user.entity';


interface CreateLocationDto {
  lat: number;
  lng: number;
  timestamp?: string;
}

@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  /**
   * POST /locations
   * Registra una nueva ubicación para el usuario autenticado
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createLocation(@Request() req: any, @Body() createLocationDto: CreateLocationDto) {
    const userId = req.user.sub;

    if (!createLocationDto.lat || !createLocationDto.lng) {
      throw new Error('lat y lng son requeridos');
    }

    console.log(`[LocationController] Registrando ubicación para usuario ${userId}:`, {
      lat: createLocationDto.lat,
      lng: createLocationDto.lng,
    });

    const location = await this.locationService.createLocation(
      userId,
      createLocationDto.lat,
      createLocationDto.lng,
    );

    return {
      success: true,
      message: 'Ubicación registrada exitosamente',
      data: location,
    };
  }

  /**
   * GET /locations/latest
   * Obtiene la última ubicación de todos los trabajadores
   */
  @Get('latest')
  @UseGuards(AuthGuard('jwt'))
  async getLatestLocations() {
    console.log('[LocationController] Obteniendo últimas ubicaciones de todos los usuarios');
    const locations = await this.locationService.findLatestPerUser();

    return {
      success: true,
      count: locations.length,
      data: locations,
    };
  }

  /**
   * GET /locations/:userId
   * Obtiene ubicaciones de un usuario específico
   * Query param opcional: date=YYYY-MM-DD
   */
  @Get(':userId')
  @UseGuards(AuthGuard('jwt'))
  async getUserLocations(@Param('userId') userId: string, @Query('date') date?: string) {
    console.log(`[LocationController] Obteniendo ubicaciones del usuario ${userId}`, date ? `para ${date}` : '');

    const locations = await this.locationService.findByUserId(userId, date);

    return {
      success: true,
      count: locations.length,
      data: locations,
    };
  }

  /**
   * GET /locations/recent/:minutes
   * Obtiene ubicaciones de los últimos N minutos
   */
  @Get('recent/:minutes')
  @UseGuards(AuthGuard('jwt'))
  async getRecentLocations(@Param('minutes') minutes: string) {
    const mins = parseInt(minutes, 10) || 60;
    console.log(`[LocationController] Obteniendo ubicaciones de los últimos ${mins} minutos`);

    const locations = await this.locationService.findRecent(mins);

    return {
      success: true,
      count: locations.length,
      data: locations,
    };
  }
}
