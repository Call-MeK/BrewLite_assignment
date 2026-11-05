import { Type } from 'class-transformer';
import { ProductSize } from '@prisma/client';
import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsEnum, IsInt, Max, Min, ValidateNested } from 'class-validator';

class SizePriceDto {
  @IsEnum(ProductSize)
  size: ProductSize;

  @IsInt() @Min(0) @Max(1000000000)
  priceAdjustment: number;
}

export class UpdateSizePricesDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(3) @ArrayUnique((item: SizePriceDto) => item?.size)
  @ValidateNested({ each: true }) @Type(() => SizePriceDto)
  sizes: SizePriceDto[];
}
