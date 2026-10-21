import { Module } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  @Get('health')
  healthCheck() {
    return { module: 'Auth', status: 'Ready for implementation (Task 7)' };
  }
}

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
