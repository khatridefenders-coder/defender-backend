import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Voter } from '../entities/voter.entity';
import { AppSettings } from '../entities/app-settings.entity';

/**
 * Shared DataSource used by:
 *  - TypeORM CLI  (migration:generate, migration:run, migration:revert, migration:show)
 *  - Seed script  (so migrations are run before data is inserted)
 *
 * The NestJS app uses TypeOrmModule.forRootAsync (app.module.ts) — it reads the same
 * env vars but imports migrations as compiled classes rather than a glob.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'constitution_defender',
  entities: [User, Voter, AppSettings],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
  migrationsRun: false, // CLI controls when to run; set to false for explicit control
});
