import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IngredientDto, IngredientIdDto, RecipeParamsDto, SaveRecipeDto } from './recipes.dto';
import { RecipesService } from './recipes.service';

@Controller('admin/recipes')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Get('catalog') @Header('Cache-Control', 'no-store')
  catalog() { return this.recipes.catalog(); }

  @Post('ingredients')
  createIngredient(@Body() dto: IngredientDto) { return this.recipes.createIngredient(dto); }

  @Patch('ingredients/:id')
  updateIngredient(@Param() params: IngredientIdDto, @Body() dto: IngredientDto) { return this.recipes.updateIngredient(params.id, dto); }

  @Delete('ingredients/:id')
  deleteIngredient(@Param() params: IngredientIdDto) { return this.recipes.deleteIngredient(params.id); }

  @Get(':productId/:size') @Header('Cache-Control', 'no-store')
  get(@Param() params: RecipeParamsDto) { return this.recipes.get(params.productId, params.size); }

  @Put(':productId/:size')
  save(@Param() params: RecipeParamsDto, @Body() dto: SaveRecipeDto) { return this.recipes.save(params.productId, params.size, dto); }
}
