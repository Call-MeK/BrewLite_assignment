import { Module } from "@nestjs/common";
import { AdminGuard } from "../../common/guards/admin.guard";
import { AuthModule } from "../auth/auth.module";
import { StockImportsController } from "./stock-imports.controller";
import { StockImportsService } from "./stock-imports.service";

@Module({
  imports: [AuthModule],
  controllers: [StockImportsController],
  providers: [StockImportsService, AdminGuard],
})
export class StockImportsModule {}
