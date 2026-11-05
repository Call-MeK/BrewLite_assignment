import { Controller, Get, Param, Post, Body, Delete, UseGuards } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.getProducts();
  }
  @Get("stats/count")
  async getCount() {
    return { success: true, data: await this.productsService.countTotal() };
  }
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.productsService.getProductDetail(id);
  }
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() createProductDto: any) {
    return {
      success: true,
      statusCode: 201,
      data: await this.productsService.create(createProductDto),
    };
  }
  // --- API CHO CÔNG THỨC (RECIPE) ---

  @Get(":id/recipe")
  async getRecipe(@Param("id") id: string) {
    return {
      success: true,
      data: await this.productsService.getRecipe(id),
    };
  }

  @Post(":id/recipe")
  @UseGuards(JwtAuthGuard, AdminGuard)
  async addRecipeItem(
    @Param("id") id: string,
    @Body() body: { ingredientId: string; quantity: number },
  ) {
    return {
      success: true,
      data: await this.productsService.addRecipeItem(
        id,
        body.ingredientId,
        body.quantity,
      ),
    };
  }

  @Delete(":id/recipe/:ingredientId")
  @UseGuards(JwtAuthGuard, AdminGuard)
  async removeRecipeItem(
    @Param("id") id: string,
    @Param("ingredientId") ingredientId: string,
  ) {
    await this.productsService.removeRecipeItem(id, ingredientId);
    return {
      success: true,
      message: "Đã xóa nguyên liệu khỏi công thức",
    };
  }
  @Delete(":id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param("id") id: string) {
    await this.productsService.remove(id);
    return {
      success: true,
      message: "Đã xóa sản phẩm thành công",
    };
  }
}
