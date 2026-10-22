import { IsInt, Min, IsOptional, IsEnum } from "class-validator";
import { ProductSize } from "@prisma/client";

export class UpdateCartItemDto {
  @IsInt({ message: "Số lượng phải là một số nguyên" })
  @Min(1, { message: "Số lượng tối thiểu là 1" })
  quantity: number;

  @IsOptional()
  @IsEnum(ProductSize, { message: "Size không hợp lệ (Chỉ nhận S, M, L)" })
  size?: ProductSize;
}
