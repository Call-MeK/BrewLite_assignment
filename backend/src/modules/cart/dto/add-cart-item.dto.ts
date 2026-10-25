import { ProductSize } from '@prisma/client';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  cartId: string;

  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;

  @IsEnum(ProductSize)
  size: ProductSize;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsString({ each: true })
  toppingIds?: string[];
}
