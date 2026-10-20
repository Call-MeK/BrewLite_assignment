import { Equals, IsString, MaxLength, Matches } from 'class-validator';

export class ZaloPayCallbackDto {
  @Equals(1)
  type: number;

  @IsString()
  @MaxLength(32768)
  data: string;

  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  mac: string;
}
