import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Voter } from '../entities/voter.entity';
import { User } from '../entities/user.entity';
import { AppSettings } from '../entities/app-settings.entity';
import { Role } from '../common/enums/role.enum';
import { CreateCoordinatorDto } from './dto/create-coordinator.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Voter)
    private readonly voterRepo: Repository<Voter>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AppSettings)
    private readonly settingsRepo: Repository<AppSettings>,
  ) {}

  // Ensure the single settings row always exists
  private async getSettings(): Promise<AppSettings> {
    let settings = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (!settings) {
      settings = await this.settingsRepo.save(
        this.settingsRepo.create({ id: 1, markingEnabled: true }),
      );
    }
    return settings;
  }

  async getMarkingStatus(): Promise<{ markingEnabled: boolean }> {
    const settings = await this.getSettings();
    return { markingEnabled: settings.markingEnabled };
  }

  async setMarkingEnabled(enabled: boolean): Promise<{ markingEnabled: boolean; message: string }> {
    const settings = await this.getSettings();
    settings.markingEnabled = enabled;
    await this.settingsRepo.save(settings);
    return {
      markingEnabled: enabled,
      message: enabled
        ? 'Marking is now OPEN — coordinators can mark voters as arrived.'
        : 'Marking is now LOCKED — coordinators cannot mark voters as arrived.',
    };
  }

  async getGlobalDashboard() {
    const [totalVoters, arrivedVoters, coordinatorCount] = await Promise.all([
      this.voterRepo.count(),
      this.voterRepo.count({ where: { isArrived: true } }),
      this.userRepo.count({ where: { role: Role.COORDINATOR } }),
    ]);
    const settings = await this.getSettings();
    return {
      totalVoters,
      arrivedVoters,
      pendingVoters: totalVoters - arrivedVoters,
      coordinatorCount,
      markingEnabled: settings.markingEnabled,
    };
  }

  /**
   * Per-coordinator breakdown.
   *
   * SQL:
   *   SELECT u.id, u."fullName", COUNT(v.id) AS total,
   *          SUM(CASE WHEN v."isArrived" THEN 1 ELSE 0 END) AS arrived,
   *          SUM(CASE WHEN NOT v."isArrived" THEN 1 ELSE 0 END) AS pending
   *   FROM voters v
   *   LEFT JOIN users u ON v."coordinatorId" = u.id
   *   WHERE v."coordinatorId" IS NOT NULL
   *   GROUP BY u.id, u."fullName"
   *   ORDER BY u."fullName" ASC;
   */
  async getCoordinatorStats() {
    const rows = await this.voterRepo
      .createQueryBuilder('v')
      .select('u.id', 'coordinatorId')
      .addSelect('u.fullName', 'coordinatorName')
      .addSelect('COUNT(v.id)', 'total')
      .addSelect('SUM(CASE WHEN v."isArrived" = true THEN 1 ELSE 0 END)', 'arrived')
      .addSelect('SUM(CASE WHEN v."isArrived" = false THEN 1 ELSE 0 END)', 'pending')
      .leftJoin('v.coordinator', 'u')
      .where('v.coordinatorId IS NOT NULL')
      .groupBy('u.id')
      .addGroupBy('u.fullName')
      .orderBy('COUNT(v.id)', 'DESC')
      .getRawMany();

    return rows.map((r) => ({
      coordinatorId:   r.coordinatorId,
      coordinatorName: r.coordinatorName,
      total:           parseInt(r.total, 10),
      arrived:         parseInt(r.arrived, 10),
      pending:         parseInt(r.pending, 10),
    }));
  }

  async getAllVoters(opts: {
    search?: string;
    coordinatorId?: string;
    status?: string;
    page: number;
    limit: number;
  }): Promise<{ data: Voter[]; total: number }> {
    const { search, coordinatorId, status, page, limit } = opts;

    const qb = this.voterRepo
      .createQueryBuilder('voter')
      .leftJoinAndSelect('voter.coordinator', 'coordinator')
      .orderBy('voter.sheetRowIndex', 'ASC', 'NULLS LAST')
      .skip(page * limit)
      .take(limit);

    if (coordinatorId)
      qb.andWhere('voter.coordinatorId = :coordinatorId', { coordinatorId });
    if (status === 'arrived')
      qb.andWhere('voter.isArrived = true');
    else if (status === 'pending')
      qb.andWhere('voter.isArrived = false');
    if (search)
      qb.andWhere('voter.fullName ILIKE :search', { search: `%${search}%` });

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  getCoordinators(): Promise<User[]> {
    return this.userRepo.find({
      where: { role: Role.COORDINATOR },
      order: { fullName: 'ASC' },
    });
  }

  async createCoordinator(dto: CreateCoordinatorDto): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { username: dto.username } });
    if (existing) throw new ConflictException(`Username "${dto.username}" is already taken`);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.userRepo.save(
      this.userRepo.create({
        username:           dto.username,
        fullName:           dto.fullName,
        phone:              dto.phone,
        passwordHash,
        role:               Role.COORDINATOR,
        mustChangePassword: true,
      }),
    );
  }

  async deleteCoordinator(coordinatorId: string): Promise<void> {
    const coordinator = await this.userRepo.findOne({
      where: { id: coordinatorId, role: Role.COORDINATOR },
    });
    if (!coordinator) throw new NotFoundException(`Coordinator ${coordinatorId} not found`);

    // Unassign all voters first, then delete the user
    await this.voterRepo.update({ coordinatorId }, { coordinatorId: null });
    await this.userRepo.delete({ id: coordinatorId });
  }

  async assignCoordinator(voterId: string, coordinatorId: string | null): Promise<Voter> {
    const voter = await this.voterRepo.findOne({ where: { id: voterId } });
    if (!voter) throw new NotFoundException(`Voter ${voterId} not found`);

    if (coordinatorId !== null) {
      const coordinator = await this.userRepo.findOne({
        where: { id: coordinatorId, role: Role.COORDINATOR },
      });
      if (!coordinator) throw new NotFoundException(`Coordinator ${coordinatorId} not found`);
    }

    voter.coordinatorId = coordinatorId;
    return this.voterRepo.save(voter);
  }

  async resetAllArrived(): Promise<{ reset: number }> {
    const result = await this.voterRepo
      .createQueryBuilder()
      .update(Voter)
      .set({ isArrived: false, arrivedAt: null, markedArrivedBy: null })
      .where('"isArrived" = true')
      .execute();
    return { reset: result.affected ?? 0 };
  }

  async adminMarkArrived(voterId: string, markedByLabel: string): Promise<Voter> {
    const voter = await this.voterRepo.findOne({ where: { id: voterId } });
    if (!voter) throw new NotFoundException(`Voter ${voterId} not found`);

    voter.isArrived       = true;
    voter.markedArrivedBy = markedByLabel;
    voter.arrivedAt       = new Date();

    return this.voterRepo.save(voter);
  }
}
