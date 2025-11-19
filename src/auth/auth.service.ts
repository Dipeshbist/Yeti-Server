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

  async register(registerdto: RegisterDto) {
    // Check for duplicate email or phone
    const existingUser = await this.db.user.findFirst({
      where: {
        OR: [{ email: registerdto.email }, { phone: registerdto.phone }],
      },
    });

    if (existingUser) {
      throw new BadRequestException(
        existingUser.email === registerdto.email
          ? 'Email already registered'
          : 'Phone number already registered',
      );
    }

    const hashed = await bcrypt.hash(registerdto.password, 10);
    const user = await this.db.user.create({
      data: {
        email: registerdto.email,
        phone: registerdto.phone,
        password: hashed,
        firstName: registerdto.firstName ?? null,
        lastName: registerdto.lastName ?? null,
        role: 'user',
        status: 'PENDING',
        customerId: null,
        auditLogsCreated: {
          create: {
            action: 'USER_REGISTERED',
            details: `email=${registerdto.email}, phone=${registerdto.phone}`,
          },
        },
      },
    });

    await this.notifyMail.notifyAdminsNewRegistration({
      userId: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      phone: user.phone ?? undefined,
      createdAt: user.createdAt,
    });

    return {
      message: 'Registration submitted, wait for admin approval',
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        status: user.status,
        role: user.role,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.db.user.findUnique({
      where: { email: loginDto.email },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'VERIFIED' || !user.isActive) {
      throw new UnauthorizedException('Account not verified');
    }

    const isPasswordCorrect = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
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
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  async logout() {
    // No refresh token is used; frontend clears access token
    return { message: 'Logged out successfully' };
  }

  async updateProfileImage(
    userId: string,
    imageUrl: string,
    cloudinaryId: string,
  ) {
    return this.db.user.update({
      where: { id: userId },
      data: {
        profileImage: imageUrl,
        cloudinaryId: cloudinaryId,
      },
    });
  }

  async getUserById(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        customerId: true,
        profileImage: true,
        cloudinaryId: true,
      },
    });

    if (!user) throw new Error('User not found');
    return user;
  }

  async removeProfileImage(userId: string) {
    return this.db.user.update({
      where: { id: userId },
      data: {
        profileImage: null,
        cloudinaryId: null,
      },
    });
  }
}
