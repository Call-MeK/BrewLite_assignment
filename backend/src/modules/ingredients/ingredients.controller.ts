import { IngredientUnit } from "@prisma/client";
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from "@nestjs/common";
import { IngredientsService } from "./ingredients.service";

@Controller("ingredients")
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Post()
  create(
    @Body()
    createIngredientDto: {
      name: string;
      unit: IngredientUnit;
      stock: number;
      price: number;
    },
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
  update(@Param("id") id: string, @Body() updateIngredientDto: any) {
    return this.ingredientsService.update(id, updateIngredientDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.ingredientsService.remove(id);
  }
}
