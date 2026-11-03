import { Module } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AuthModule } from '../auth/auth.module';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({ imports: [AuthModule], controllers: [RecipesController], providers: [RecipesService, AdminGuard] })
export class RecipesModule {}
