import { Controller, Get } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findCategories();
  }
}