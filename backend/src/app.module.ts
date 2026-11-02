import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ProductsModule } from "./modules/products/products.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { CartModule } from "./modules/cart/cart.module";
import { ScheduleModule } from "@nestjs/schedule";
import { IngredientsModule } from "./modules/ingredients/ingredients.module";
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    IngredientsModule,
    PrismaModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    CartModule,
    ScheduleModule.forRoot(),
  ],
})
export class AppModule {}
