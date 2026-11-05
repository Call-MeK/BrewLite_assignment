import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from "@nestjs/common";
import { IngredientsService } from "./ingredients.service";
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';

@Controller("ingredients")
@UseGuards(JwtAuthGuard, AdminGuard)
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Post()
  create(
    @Body()
    createIngredientDto: CreateIngredientDto,
  ) {
    return this.ingredientsService.create(createIngredientDto);
  }

  @Get()
  findAll() {
    return this.ingredientsService.findAll();
  }
  @Get("stats/low-stock")
  async getLowStock() {
    return { success: true, data: await this.ingredientsService.getLowStock() };
  }
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.ingredientsService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateIngredientDto: UpdateIngredientDto) {
    return this.ingredientsService.update(id, updateIngredientDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.ingredientsService.remove(id);
  }
}
