import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SpotsModule } from '../spots/spots.module';
import { UsersModule } from '../users/users.module';
import { AdminHomeController } from './admin-home.controller';
import { HomeController } from './home.controller';
import { HomeSettingEntity } from './entities/home-setting.entity';
import { HomeService } from './home.service';

@Module({
  imports: [
    SpotsModule,
    UsersModule,
    TypeOrmModule.forFeature([HomeSettingEntity]),
  ],
  controllers: [HomeController, AdminHomeController],
  providers: [HomeService, RolesGuard],
})
export class HomeModule {}
