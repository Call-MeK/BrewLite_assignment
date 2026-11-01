import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class QueryProductDto {
  @IsOptional() @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional() @IsString()
  @MaxLength(36)
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  @Max(1000000)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 12;
}
