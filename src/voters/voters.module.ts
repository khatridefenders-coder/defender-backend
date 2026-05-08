import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VotersController } from './voters.controller';
import { VotersService } from './voters.service';
import { Voter } from '../entities/voter.entity';
import { AppSettings } from '../entities/app-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Voter, AppSettings])],
  controllers: [VotersController],
  providers: [VotersService],
  exports: [VotersService],
})
export class VotersModule {}
