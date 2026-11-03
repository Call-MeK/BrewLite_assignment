import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class PaymentManagementQueryDto {
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
  limit = 6;

  @IsOptional()
  @IsIn(['ALL', 'MOCK', 'ZALOPAY_SANDBOX', 'BANK_TRANSFER'])
  source: 'ALL' | 'MOCK' | 'ZALOPAY_SANDBOX' | 'BANK_TRANSFER' = 'ALL';

  @IsOptional()
  @IsIn(['ALL', 'SUCCESS', 'PENDING', 'FAILED', 'REVIEW'])
  status: 'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED' | 'REVIEW' = 'ALL';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  to?: string;
}
