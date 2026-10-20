import { Module, Controller, Get } from '@nestjs/common';

@Controller('products')
export class ProductsController {
  @Get()
  getProducts() {
    return [
      {
        id: 'sample-1',
        name: 'Cà phê sữa đá (Mock)',
        basePrice: 35000,
        imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400',
        stock: 50,
      },
      {
        id: 'sample-2',
        name: 'Americano (Mock)',
        basePrice: 40000,
        imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400',
        stock: 30,
      },
    ];
  }
}

@Module({
  controllers: [ProductsController],
})
export class ProductsModule {}
