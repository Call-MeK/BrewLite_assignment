import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UsersQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000000)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit = 10;

  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @IsIn(['ALL', 'CUSTOMER', 'ADMIN'])
  role: 'ALL' | UserRole = 'ALL';
}

export class UserIdDto {
  @IsString() @IsNotEmpty() @MaxLength(36)
  id: string;
}

export class UserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}
