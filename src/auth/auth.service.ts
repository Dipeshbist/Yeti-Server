import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto, UserResponse } from './login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    loginDto: LoginDto,
  ): Promise<{ user: UserResponse; token: string }> {
    const { email, password } = loginDto;

    // Step 1: Manual email/password to customerId mapping
    type ManualUser = {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      customerId: string;
    };

    const userMappings: Record<string, ManualUser> = {
      // 'admin@company.com': {
      //   email: 'admin@company.com',
      //   password: 'admin123',
      //   firstName: 'Admin',
      //   lastName: 'User',
      //   customerId: 'ff6df8c0-a596-11f0-a310-85b2fcee570f',
      // },
      // 'test@demo.com': {
      //   email: 'test@demo.com',
      //   password: 'test123',
      //   firstName: 'Test',
      //   lastName: 'User',
      //   customerId: 'ff6df8c0-a596-11f0-a310-85b2fcee570f',
      // },
      // 'nds@company.com': {
      //   email: 'nds@company.com',
      //   password: 'nds123',
      //   firstName: 'NDS',
      //   lastName: 'User',
      //   customerId: 'ff6df8c0-a596-11f0-a310-85b2fcee570f',
      // },
      // 'test@yeti.com': {
      //   email: 'test@yeti.com',
      //   password: 'test123',
      //   firstName: 'Test',
      //   lastName: 'User',
      //   customerId: 'ff6df8c0-a596-11f0-a310-85b2fcee570f',
      // },

      // 'test@garud.cloud': {
      //   email: 'test@garud.cloud',
      //   password: 'test123',
      //   firstName: 'Test',
      //   lastName: 'User',
      //   customerId: 'ff6df8c0-a596-11f0-a310-85b2fcee570f',
      // },
      'test@garud.com': {
        email: 'test@garud.com',
        password: 'test123',
        firstName: 'Admin',
        lastName: 'User',
        customerId: 'ff6df8c0-a596-11f0-a310-85b2fcee570f',
      },
      // Add more users here as needed
    };

    // Step 2: Validate email/password against manual mapping
    const mappedUser: ManualUser | undefined = userMappings[email];
    if (!mappedUser || mappedUser.password !== password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Step 3: Check if user exists in database, if not create them
    let dbUser = await this.db.findUserByEmail(email);

    if (!dbUser) {
      // Create new user in database with mapped data
      const hashedPassword = await bcrypt.hash(password, 12);
      dbUser = await this.db.user.create({
        data: {
          email: mappedUser.email,
          password: hashedPassword,
          firstName: mappedUser.firstName,
          lastName: mappedUser.lastName,
          customerId: mappedUser.customerId,
          isActive: true,
        },
      });
      console.log(
        `✅ Created new user in database: ${dbUser.email} -> Customer: ${dbUser.customerId}`,
      );
    } else {
      // Update existing user with latest mapping data
      dbUser = await this.db.user.update({
        where: { email: email },
        data: {
          firstName: mappedUser.firstName,
          lastName: mappedUser.lastName,
          customerId: mappedUser.customerId,
          isActive: true,
        },
      });
      console.log(
        `✅ Updated user in database: ${dbUser.email} -> Customer: ${dbUser.customerId}`,
      );
    }

    // Step 4: Generate JWT token
    const userResponse = this.mapToUserResponse(dbUser);
    const token = this.generateToken(userResponse);

    return { user: userResponse, token };
  }

  async validateUser(userId: string): Promise<UserResponse | null> {
    const user = await this.db.findUserById(userId);
    return user ? this.mapToUserResponse(user) : null;
  }

  async getUserProfile(userId: string): Promise<UserResponse> {
    const user = await this.db.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.mapToUserResponse(user);
  }

  private generateToken(user: UserResponse): string {
    const payload = {
      sub: user.id,
      email: user.email,
      customerId: user.customerId,
    };
    return this.jwtService.sign(payload);
  }

  private mapToUserResponse(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    customerId: string;
    createdAt: Date;
  }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      customerId: user.customerId,
      createdAt: user.createdAt,
    };
  }
}
