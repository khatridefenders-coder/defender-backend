import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { Voter } from './voter.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @Column()
  fullName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: true })
  mustChangePassword: boolean;

  @OneToMany(() => Voter, (voter) => voter.coordinator)
  voters: Voter[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
