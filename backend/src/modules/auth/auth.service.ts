import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const publicUserSelect = {
  id: true,
  email: true,
  fullName: true,
  loyaltyPoints: true,
} satisfies Prisma.UserSelect;

type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    this.assertPasswordLength(dto.password);
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new ConflictException('Email này đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    let user: User;
    try {
      user = await this.prisma.user.create({
        data: { email, passwordHash, fullName: dto.fullName.trim() },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email này đã được sử dụng');
      }
      throw error;
    }
    return this.createSession(this.toPublicUser(user), user.tokenVersion);
  }

  async login(dto: LoginDto) {
    this.assertPasswordLength(dto.password);
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }
    return this.createSession(this.toPublicUser(user), user.tokenVersion);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    this.assertPasswordLength(dto.currentPassword);
    this.assertPasswordLength(dto.newPassword);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    const result = await this.prisma.user.updateMany({
      where: {
        id: userId,
        passwordHash: user.passwordHash,
        tokenVersion: user.tokenVersion,
      },
      data: { passwordHash: newHash, tokenVersion: { increment: 1 } },
    });
    if (result.count !== 1) {
      throw new UnauthorizedException('Tài khoản đã thay đổi, vui lòng đăng nhập lại');
    }
    return this.createSession(this.toPublicUser(user), user.tokenVersion + 1);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });
    if (!user) {
      throw new UnauthorizedException('Tài khoản không còn tồn tại');
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const email = dto.email.trim().toLowerCase();
    const current = await this.prisma.user.findUnique({
      where: { id: userId }, select: { email: true, passwordHash: true },
    });
    if (!current) throw new UnauthorizedException('Tài khoản không còn tồn tại');
    if (email !== current.email) {
      if (!dto.currentPassword) throw new BadRequestException('Cần mật khẩu hiện tại để đổi email');
      this.assertPasswordLength(dto.currentPassword);
      if (!(await bcrypt.compare(dto.currentPassword, current.passwordHash))) {
        throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
      }
    }
    try {
      const { tokenVersion, ...user } = await this.prisma.user.update({
        where: { id: userId, email: current.email, passwordHash: current.passwordHash },
        data: { email, fullName: dto.fullName.trim() },
        select: { ...publicUserSelect, tokenVersion: true },
      });
      return this.createSession(user, tokenVersion);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email này đã được sử dụng');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new UnauthorizedException('Tài khoản không còn tồn tại');
      }
      throw error;
    }
  }

  private async createSession(user: PublicUser, tokenVersion: number) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      ver: tokenVersion,
    });
    return { accessToken, user };
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      loyaltyPoints: user.loyaltyPoints,
    };
  }

  private assertPasswordLength(password: string) {
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException('Mật khẩu không được vượt quá 72 byte');
    }
  }
}
