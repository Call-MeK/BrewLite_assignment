import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductSize } from '@prisma/client';

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  productId: string;

  @IsOptional()
  @IsEnum(ProductSize)
  size?: ProductSize;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(36, { each: true })
  @IsNotEmpty({ each: true })
  toppingIds?: string[];
}

export class CreateOrderDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  promotionCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsToUse?: number;
}
