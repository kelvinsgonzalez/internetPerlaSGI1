import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Customer } from "./customer.entity";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";
import { PlansController } from "./plans.controller";
import { PlansService } from "./plans.service";

@Module({
  imports: [TypeOrmModule.forFeature([Customer])],
  providers: [CustomersService, PlansService],
  controllers: [CustomersController, PlansController],
})
export class CustomersModule {}
