import { Controller, Get, Post, Patch, Delete, Param, Query, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { MarkedBy } from '../common/decorators/marked-by.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateCoordinatorDto } from './dto/create-coordinator.dto';
import { AssignCoordinatorDto } from './dto/assign-coordinator.dto';

@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getGlobalDashboard() {
    return this.adminService.getGlobalDashboard();
  }

  @Get('coordinators/stats')
  getCoordinatorStats() {
    return this.adminService.getCoordinatorStats();
  }

  @Get('voters')
  getAllVoters(
    @Query('search') search?: string,
    @Query('coordinatorId') coordinatorId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllVoters({
      search,
      coordinatorId,
      status,
      page:  page  !== undefined ? parseInt(page,  10) : 0,
      limit: limit !== undefined ? parseInt(limit, 10) : 50,
    });
  }

  @Patch('voters/:id/arrive')
  adminMarkArrived(@Param('id') id: string, @MarkedBy() markedByLabel: string) {
    return this.adminService.adminMarkArrived(id, markedByLabel);
  }

  @Patch('voters/:id/coordinator')
  @HttpCode(HttpStatus.OK)
  assignCoordinator(@Param('id') id: string, @Body() dto: AssignCoordinatorDto) {
    return this.adminService.assignCoordinator(id, dto.coordinatorId);
  }

  @Get('coordinators')
  getCoordinators() {
    return this.adminService.getCoordinators();
  }

  @Post('coordinators')
  @HttpCode(HttpStatus.CREATED)
  createCoordinator(@Body() dto: CreateCoordinatorDto) {
    return this.adminService.createCoordinator(dto);
  }

  @Delete('coordinators/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCoordinator(@Param('id') id: string) {
    return this.adminService.deleteCoordinator(id);
  }

  // -----------------------------------------------------------------------
  // Marking lock controls — admin only
  // -----------------------------------------------------------------------

  @Get('marking/status')
  getMarkingStatus() {
    return this.adminService.getMarkingStatus();
  }

  @Patch('voters/reset-arrived')
  @HttpCode(HttpStatus.OK)
  resetAllArrived() {
    return this.adminService.resetAllArrived();
  }

  @Patch('marking/enable')
  enableMarking() {
    return this.adminService.setMarkingEnabled(true);
  }

  @Patch('marking/disable')
  disableMarking() {
    return this.adminService.setMarkingEnabled(false);
  }
}
