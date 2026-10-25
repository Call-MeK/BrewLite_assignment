import { ProductSize } from '@prisma/client';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsInt, IsString, Max, Min, ValidateIf } from 'class-validator';

export class UpdateCartItemDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(ProductSize)
  size?: ProductSize;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsString({ each: true })
  toppingIds?: string[];
}
