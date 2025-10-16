import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly db: DatabaseService) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    customerId: string | null;
  }) {
    const user = await this.db.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive)
      throw new UnauthorizedException('User not found or inactive');

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      customerId: payload.customerId,
    };
  }
}
