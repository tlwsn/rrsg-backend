import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Role } from '../entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Thomas_Lawson' })
  @IsString()
  @IsNotEmpty()
  nick: string;

  @ApiProperty({ example: 'Бима' })
  @IsString()
  @IsNotEmpty()
  callsign: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;
}
