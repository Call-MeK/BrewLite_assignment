import { Module } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Get('health')
  healthCheck() {
    return { module: 'Auth', status: 'Ready for implementation (Task 7)' };
  }
}

@Module({
  controllers: [AuthController],
})
export class AuthModule {}
