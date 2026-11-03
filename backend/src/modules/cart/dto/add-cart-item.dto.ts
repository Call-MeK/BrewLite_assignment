import { ProductSize } from '@prisma/client';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  cartId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
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
  @IsNotEmpty({ each: true })
  @MaxLength(36, { each: true })
  toppingIds?: string[];
}
