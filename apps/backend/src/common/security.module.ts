import { Global, Module } from '@nestjs/common';
import { BruteForceService } from './brute-force.service';

/** El freno de fuerza bruta debe ser UNA sola instancia compartida. */
@Global()
@Module({
  providers: [BruteForceService],
  exports: [BruteForceService],
})
export class SecurityModule {}
