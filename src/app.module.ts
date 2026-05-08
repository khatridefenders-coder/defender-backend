import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { VotersModule } from './voters/voters.module';
import { AdminModule } from './admin/admin.module';
import { SyncModule } from './sync/sync.module';
import { User } from './entities/user.entity';
import { Voter } from './entities/voter.entity';
import { AppSettings } from './entities/app-settings.entity';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { InitialSetup1777800000000 } from './database/migrations/1777800000000-InitialSetup';
import { AddSheetRowIndex1777800000001 } from './database/migrations/1777800000001-AddSheetRowIndex';
import { AddFCardNo1777800000002 } from './database/migrations/1777800000002-AddFCardNo';

@Module({
  imports: [
    // Loads .env and makes ConfigService available globally — must be first
    ConfigModule.forRoot({ isGlobal: true }),

    // forRootAsync reads env vars lazily (after DI container is ready, not at parse time)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 5432),
        username: cfg.get<string>('DB_USER', 'postgres'),
        password: cfg.get<string>('DB_PASSWORD', 'postgres'),
        database: cfg.get<string>('DB_NAME', 'constitution_defender'),
        entities: [User, Voter, AppSettings],
        synchronize: false,
        migrations: [InitialSetup1777800000000, AddSheetRowIndex1777800000001, AddFCardNo1777800000002],
        migrationsTableName: 'typeorm_migrations',
        migrationsRun: false,
      }),
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host: cfg.get<string>('REDIS_HOST', 'localhost'),
          port: cfg.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),

    AuthModule,
    VotersModule,
    AdminModule,
    SyncModule,
  ],
  providers: [
    // Global guards — applied to every route automatically.
    // Routes marked @Public() bypass JWT. Routes without @Roles() are accessible by any authenticated user.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
