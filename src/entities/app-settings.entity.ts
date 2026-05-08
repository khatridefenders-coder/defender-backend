import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Single-row settings table (id is always 1).
 * Admin controls markingEnabled to open/close voter check-in for all coordinators at once.
 */
@Entity('app_settings')
export class AppSettings {
  @PrimaryColumn()
  id: number;

  @Column({ default: true })
  markingEnabled: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
