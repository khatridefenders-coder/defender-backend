import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncProcessor } from './sync.processor';
import { User } from '../entities/user.entity';
import { Voter } from '../entities/voter.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Voter]),
    BullModule.registerQueue({ name: 'sheet-sync' }),
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncProcessor],
})
export class SyncModule {}
