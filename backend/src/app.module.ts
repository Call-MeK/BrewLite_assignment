import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CartModule } from './modules/cart/cart.module';
import { UsersModule } from './modules/users/users.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestLimitsInterceptor } from './common/interceptors/request-limits.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    CartModule,
    UsersModule,
    RecipesModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: RequestLimitsInterceptor }],
})
export class AppModule {}
