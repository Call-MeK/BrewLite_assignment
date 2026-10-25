import { Matches } from 'class-validator';

export class OrderIdParamDto {
  @Matches(/^c[a-z0-9]{24}$/)
  id: string;
}
