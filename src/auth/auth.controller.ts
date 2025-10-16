import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { LoginDto } from './login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './Auth.Service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body(ValidationPipe) dto: RegisterDto) {
    const res = await this.authService.register(dto);
    return {
      success: true,
      message: res.message,
      user: res.user,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body(ValidationPipe) loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    return {
      success: true,
      message: 'Login successful',
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(
    @Request()
    req: {
      user: {
        sub: string;
        email: string;
        role: string;
        customerId: string | null;
      };
    },
  ) {
    return { success: true, user: req.user };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout() {
    return this.authService.logout();
  }
}
