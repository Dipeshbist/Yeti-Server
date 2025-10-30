/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
  UseInterceptors,
  UploadedFile,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import { LoginDto } from './login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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

  // @Get('profile')
  // @UseGuards(JwtAuthGuard)
  // getProfile(
  //   @Request()
  //   req: {
  //     user: {
  //       sub: string;
  //       email: string;
  //       role: string;
  //       customerId: string | null;
  //     };
  //   },
  // ) {
  //   return { success: true, user: req.user };
  // }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    const userId = req.user.userId || req.user.sub; // JWT payload may differ

    const user = await this.authService.getUserById(userId);

    return {
      success: true,
      user,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout() {
    return this.authService.logout();
  }

  @Post('upload-avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    const userId = req.user.userId || req.user.sub; // ✅ supports both token styles

    // 1️⃣ Fetch existing user to check for an old image
    const existingUser = await this.authService.getUserById(userId);

    // 2️⃣ If a previous image exists, delete it from Cloudinary
    if (existingUser.cloudinaryId) {
      try {
        await this.cloudinaryService.deleteImage(existingUser.cloudinaryId);
        console.log(`🧹 Old image deleted: ${existingUser.cloudinaryId}`);
      } catch (err) {
        console.warn('⚠️ Failed to delete old Cloudinary image:', err.message);
      }
    }

    // 3️⃣ Upload the new image
    const result = (await this.cloudinaryService.uploadImage(
      file,
      'avatars',
    )) as {
      secure_url: string;
      public_id: string;
    };

    // 4️⃣ Save new URL + Cloudinary public_id in DB
    await this.authService.updateProfileImage(
      userId,
      result.secure_url,
      result.public_id,
    );

    // 5️⃣ Return the updated user record for frontend refresh
    const updatedUser = await this.authService.getUserById(userId);

    return { success: true, user: updatedUser };
  }

  @Delete('delete-avatar')
  @UseGuards(JwtAuthGuard)
  async deleteAvatar(@Request() req) {
    const userId = req.user.userId || req.user.sub;

    // 1️⃣ Get user from DB
    const user = await this.authService.getUserById(userId);

    if (!user?.cloudinaryId) {
      throw new BadRequestException('No avatar to delete');
    }

    // 2️⃣ Delete from Cloudinary
    await this.cloudinaryService.deleteImage(user.cloudinaryId);

    // 3️⃣ Clear image fields in DB
    await this.authService.removeProfileImage(userId);

    return { success: true, message: 'Avatar removed successfully' };
  }
}
