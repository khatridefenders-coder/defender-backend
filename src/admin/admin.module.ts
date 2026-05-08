import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Voter } from '../entities/voter.entity';
import { User } from '../entities/user.entity';
import { AppSettings } from '../entities/app-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Voter, User, AppSettings])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
