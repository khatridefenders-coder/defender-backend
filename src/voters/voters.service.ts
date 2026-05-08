import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Voter } from '../entities/voter.entity';
import { User } from '../entities/user.entity';
import { AppSettings } from '../entities/app-settings.entity';
import { Role } from '../common/enums/role.enum';
import { VoterFilterDto } from './dto/voter-filter.dto';

// Columns returned to coordinators — phone intentionally excluded
const COORDINATOR_VOTER_SELECT = [
  'v.id', 'v.sheetRowIndex', 'v.fCardNo', 'v.memberName', 'v.fatherName', 'v.orakh', 'v.fullName',
  'v.cardNo', 'v.address', 'v.pollingStation',
  'v.isArrived', 'v.markedArrivedBy', 'v.arrivedAt',
  'v.coordinatorId', 'v.createdAt', 'v.updatedAt',
];

@Injectable()
export class VotersService {
  constructor(
    @InjectRepository(Voter)
    private readonly voterRepo: Repository<Voter>,
    @InjectRepository(AppSettings)
    private readonly settingsRepo: Repository<AppSettings>,
  ) {}

  private async assertMarkingEnabled(): Promise<void> {
    const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (settings && !settings.markingEnabled) {
      throw new ForbiddenException(
        'Marking is currently disabled by the admin. Please contact the administrator.',
      );
    }
  }

  async getPendingForCoordinator(
    coordinator: User,
    search?: string,
    page = 0,
    limit = 50,
  ): Promise<{ data: Voter[]; total: number }> {
    const qb = this.voterRepo
      .createQueryBuilder('v')
      .select(COORDINATOR_VOTER_SELECT)
      .where('v.coordinatorId = :id', { id: coordinator.id })
      .andWhere('v.isArrived = false')
      .orderBy('v.sheetRowIndex', 'ASC', 'NULLS LAST')
      .skip(page * limit)
      .take(limit);
    if (search) qb.andWhere('v.fullName ILIKE :search', { search: `%${search}%` });
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async getAllForCoordinator(
    coordinator: User,
    filter: VoterFilterDto,
  ): Promise<{ data: Voter[]; total: number }> {
    const page  = filter.page  ?? 0;
    const limit = filter.limit ?? 50;
    const qb = this.voterRepo
      .createQueryBuilder('v')
      .select(COORDINATOR_VOTER_SELECT)
      .where('v.coordinatorId = :id', { id: coordinator.id })
      .orderBy('v.sheetRowIndex', 'ASC', 'NULLS LAST')
      .skip(page * limit)
      .take(limit);
    if (filter.isArrived !== undefined)
      qb.andWhere('v.isArrived = :isArrived', { isArrived: filter.isArrived });
    if (filter.search)
      qb.andWhere('v.fullName ILIKE :search', { search: `%${filter.search}%` });
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async markArrived(voterId: string, markedByLabel: string, requestingUser: User): Promise<Voter> {
    await this.assertMarkingEnabled();

    const voter = await this.voterRepo.findOne({ where: { id: voterId } });
    if (!voter) throw new NotFoundException(`Voter ${voterId} not found`);

    if (requestingUser.role === Role.COORDINATOR && voter.coordinatorId !== requestingUser.id) {
      throw new ForbiddenException('You may only mark voters assigned to you');
    }

    voter.isArrived       = true;
    voter.markedArrivedBy = markedByLabel;
    voter.arrivedAt       = new Date();

    return this.voterRepo.save(voter);
  }

  async unmarkArrived(voterId: string, requestingUser: User): Promise<Voter> {
    const voter = await this.voterRepo.findOne({ where: { id: voterId } });
    if (!voter) throw new NotFoundException(`Voter ${voterId} not found`);

    if (requestingUser.role === Role.COORDINATOR && voter.coordinatorId !== requestingUser.id) {
      throw new ForbiddenException('You may only revert voters assigned to you');
    }

    voter.isArrived       = false;
    voter.markedArrivedBy = null;
    voter.arrivedAt       = null;

    return this.voterRepo.save(voter);
  }

  async getDashboardStats(coordinator: User) {
    const [totalVoters, arrivedVoters] = await Promise.all([
      this.voterRepo.count({ where: { coordinatorId: coordinator.id } }),
      this.voterRepo.count({ where: { coordinatorId: coordinator.id, isArrived: true } }),
    ]);
    return { totalVoters, arrivedVoters, pendingVoters: totalVoters - arrivedVoters };
  }
}
