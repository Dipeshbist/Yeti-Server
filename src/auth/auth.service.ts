/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './login.dto';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { NotifyMailService } from '../email/notifymail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly notifyMail: NotifyMailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.db.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new BadRequestException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.db.user.create({
      data: {
        email: dto.email,
        password: hashed,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        role: 'user',
        status: 'PENDING',
        customerId: null,
        auditLogsCreated: {
          create: {
            action: 'USER_REGISTERED',
            details: `email=${dto.email}`,
          },
        },
      },
    });

    await this.notifyMail.notifyAdminsNewRegistration({
      userId: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      createdAt: user.createdAt,
    });

    return {
      message: 'Registration submitted, wait for admin approval',
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        role: user.role,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.db.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'VERIFIED' || !user.isActive) {
      throw new UnauthorizedException('Account not verified');
    }

    const isPasswordCorrect = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordCorrect)
      throw new UnauthorizedException('Invalid credentials');

    // Strictly typed payload
    const payload: {
      sub: string;
      email: string;
      role: string;
      customerId: string | null;
    } = {
      sub: user.id,
      email: user.email,
      role: user.role,
      customerId: user.customerId ?? null,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '1d' });

    return {
      success: true,
      message: 'Login successful',
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        customerId: user.customerId,
      },
    };
  }

  async logout() {
    // No refresh token is used; frontend clears access token
    return { message: 'Logged out successfully' };
  }
}
