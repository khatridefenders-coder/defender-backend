import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { VotersService } from './voters.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MarkedBy } from '../common/decorators/marked-by.decorator';
import { Role } from '../common/enums/role.enum';
import { User } from '../entities/user.entity';
import { VoterFilterDto } from './dto/voter-filter.dto';

// Guards are applied globally via APP_GUARD in AppModule.
// @Roles() here restricts the whole controller to coordinators (admins bypass via RolesGuard).
@Controller('voters')
@Roles(Role.COORDINATOR)
export class VotersController {
  constructor(private readonly votersService: VotersService) {}

  @Get('pending')
  getPending(@CurrentUser() user: User, @Query() filter: VoterFilterDto) {
    return this.votersService.getPendingForCoordinator(user, filter.search, filter.page ?? 0, filter.limit ?? 50);
  }

  @Get('all')
  getAll(@CurrentUser() user: User, @Query() filter: VoterFilterDto) {
    return this.votersService.getAllForCoordinator(user, filter);
  }

  @Get('dashboard/stats')
  getStats(@CurrentUser() user: User) {
    return this.votersService.getDashboardStats(user);
  }

  @Patch(':id/arrive')
  markArrived(
    @Param('id') id: string,
    @MarkedBy() markedByLabel: string,
    @CurrentUser() user: User,
  ) {
    return this.votersService.markArrived(id, markedByLabel, user);
  }

  @Patch(':id/unmark')
  unmarkArrived(@Param('id') id: string, @CurrentUser() user: User) {
    return this.votersService.unmarkArrived(id, user);
  }
}
