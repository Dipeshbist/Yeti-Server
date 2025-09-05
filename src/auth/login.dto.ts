import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import 'reflect-metadata';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class UserResponse {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  customerId: string;
  createdAt: Date;
}
