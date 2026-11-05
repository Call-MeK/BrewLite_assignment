import { Controller, Get, Module, Param } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { CategoriesController } from './categories.controller';
import { ProductsService } from './products.service';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from '../../common/guards/admin.guard';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController, CategoriesController],
  providers: [ProductsService, AdminGuard],
})
export class ProductsModule {}
