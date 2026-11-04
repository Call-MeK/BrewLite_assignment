import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().normalize("NFC") : value;

export class StockImportItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  ingredientId: string;

  @IsNumber({ maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false })
  @Min(0.001)
  @Max(1000000)
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100000000)
  unitPrice: number;
}

export class CreateStockImportDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplier?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((item: StockImportItemDto) => item?.ingredientId)
  @ValidateNested({ each: true })
  @Type(() => StockImportItemDto)
  items: StockImportItemDto[];
}

export class StockImportsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 10;
}

export class StockImportIdDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  id: string;
}
