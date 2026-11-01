import { Body, Controller, Get, Header, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserIdDto, UserRoleDto, UsersQueryDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@Req() req: { user: JwtPayload }) { return this.users.me(req.user.sub); }

  @Get()
  @UseGuards(AdminGuard)
  @Header('Cache-Control', 'no-store')
  list(@Query() query: UsersQueryDto) { return this.users.list(query); }

  @Patch(':id/role')
  @UseGuards(AdminGuard)
  @Header('Cache-Control', 'no-store')
  setRole(@Req() req: { user: JwtPayload }, @Param() params: UserIdDto, @Body() body: UserRoleDto) {
    return this.users.setRole(req.user.sub, params.id, body.role);
  }
}
