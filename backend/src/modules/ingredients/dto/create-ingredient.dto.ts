import { IngredientUnit } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateIngredientDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value)
  @IsString() @IsNotEmpty() @MaxLength(100)
  name: string;

  @IsEnum(IngredientUnit)
  unit: IngredientUnit;

  @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(1000000000)
  stock: number;

  @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(1000000000)
  price: number;
}
