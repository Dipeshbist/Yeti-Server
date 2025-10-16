import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsBoolean } from 'class-validator';
// import { UserRole } from '@prisma/client';

export class UpdateUserDto {
  @ApiProperty({ required: false, enum: ['admin', 'user'] })
  @IsOptional()
  @IsEnum(['admin', 'user'])
  role?: 'admin' | 'user';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
