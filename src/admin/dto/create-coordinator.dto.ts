import { IsString, IsNotEmpty, MinLength, IsOptional } from 'class-validator';

export class CreateCoordinatorDto {
  @IsString() @IsNotEmpty()
  username: string;

  @IsString() @IsNotEmpty()
  fullName: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsString() @IsNotEmpty() @MinLength(8)
  password: string;
}
