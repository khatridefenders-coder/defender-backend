import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('voters')
export class Voter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Three name parts stored individually for data fidelity
  @Column({ nullable: true })
  memberName: string;

  @Column({ nullable: true })
  fatherName: string;

  @Column({ nullable: true })
  orakh: string;

  // Concatenation of memberName + fatherName + orakh — used for display and search
  @Column()
  fullName: string;

  // FCardNo from the source sheet — family/group card number (column 0)
  @Column({ nullable: true })
  fCardNo: string;

  // UniqueCardNo from the source sheet — used to identify voters uniquely (column 1)
  @Column({ nullable: true })
  cardNo: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  pollingStation: string;

  // Position of this voter in the source Google Sheet (0-based). Used for display order.
  @Column({ nullable: true, type: 'int' })
  sheetRowIndex: number;

  @Column({ default: false })
  isArrived: boolean;

  // Stores "Full Name (role)" of whoever marked this voter arrived
  @Column({ nullable: true })
  markedArrivedBy: string;

  @Column({ nullable: true, type: 'timestamptz' })
  arrivedAt: Date;

  @ManyToOne(() => User, (user) => user.voters, { nullable: true, eager: false })
  @JoinColumn({ name: 'coordinatorId' })
  coordinator: User;

  @Column({ nullable: true })
  coordinatorId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
