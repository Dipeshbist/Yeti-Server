// src/auth/dto/register.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsOptional,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'Password too weak. It must include uppercase, lowercase, number, and special character.',
    },
  )
  password: string;

  @IsNotEmpty()
  @Matches(/^[0-9]{10,15}$/, {
    message: 'Phone must be a valid number with 10–15 digits.',
  })
  phone: string;

  @IsOptional()
  firstName?: string;

  @IsOptional()
  lastName?: string;
}
