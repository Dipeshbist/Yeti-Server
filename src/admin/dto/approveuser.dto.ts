/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ApproveUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId: string;

  // From ThingsBoard (admin pastes it), or you can add an auto-create flow later
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  customerId: string;
}
