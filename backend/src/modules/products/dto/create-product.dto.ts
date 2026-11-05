import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateProductDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(100)
  name: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  categorySlug: string;

  @IsInt() @Min(0) @Max(1000000000)
  basePrice: number;

  @IsBoolean()
  isAvailable: boolean;
}
