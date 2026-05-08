import { IsUUID, IsOptional } from 'class-validator';

export class AssignCoordinatorDto {
  @IsOptional()
  @IsUUID()
  coordinatorId: string | null;
}
