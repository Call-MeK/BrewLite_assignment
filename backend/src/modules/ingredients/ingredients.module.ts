import { Module } from "@nestjs/common";
import { IngredientsService } from "./ingredients.service";
import { IngredientsController } from "./ingredients.controller";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../../common/guards/admin.guard';
@Module({
  imports: [AuthModule],
  controllers: [IngredientsController],
  providers: [IngredientsService, PrismaService, AdminGuard],
})
export class IngredientsModule {}
