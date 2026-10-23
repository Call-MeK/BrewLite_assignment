import { IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { LoginDto } from './login.dto';

export class RegisterDto extends LoginDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  fullName: string;
}
