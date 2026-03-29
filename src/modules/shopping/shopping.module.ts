import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersModule } from '../users/users.module';
import { AdminShoppingController } from './admin-shopping.controller';
import { ShoppingController } from './shopping.controller';
import { ShoppingPlace } from './entities/shopping.entity';
import { ShoppingService } from './shopping.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShoppingPlace]),
    AuditModule,
    UsersModule,
  ],
  controllers: [ShoppingController, AdminShoppingController],
  providers: [ShoppingService, RolesGuard],
  exports: [ShoppingService],
})
export class ShoppingModule {}
