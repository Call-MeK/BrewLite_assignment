import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsNotEmpty, IsNumber, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { IngredientUnit, ProductSize } from '@prisma/client';

export class IngredientDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().normalize('NFC') : value)
  @IsString() @IsNotEmpty() @MaxLength(100) @Matches(/^[^\x00-\x1F\x7F]+$/)
  name: string;

  @IsEnum(IngredientUnit)
  unit: IngredientUnit;
}

export class IngredientIdDto {
  @IsString() @IsNotEmpty() @MaxLength(36)
  id: string;
}

export class RecipeParamsDto {
  @IsString() @IsNotEmpty() @MaxLength(36)
  productId: string;

  @IsEnum(ProductSize)
  size: ProductSize;
}

export class RecipeItemDto {
  @IsString() @IsNotEmpty() @MaxLength(36)
  ingredientId: string;

  @IsNumber({ maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false }) @Min(0.001) @Max(1000000)
  quantity: number;
}

export class SaveRecipeDto {
  @IsArray() @ArrayMaxSize(100) @ArrayUnique((item: RecipeItemDto) => item?.ingredientId)
  @ValidateNested({ each: true }) @Type(() => RecipeItemDto)
  items: RecipeItemDto[];
}
