import { Controller, Post, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { SyncService } from './sync.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { User } from '../entities/user.entity';

@Controller('admin/sync')
@Roles(Role.ADMIN)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  triggerSync(@CurrentUser() user: User) {
    return this.syncService.triggerSync(user.id);
  }

  @Get('status/:jobId')
  getStatus(@Param('jobId') jobId: string) {
    return this.syncService.getJobStatus(jobId);
  }
}
