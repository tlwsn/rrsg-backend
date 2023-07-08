import { IsNotEmpty, IsString } from 'class-validator';

export class AuthDto {
  @IsString()
  @IsNotEmpty()
  nick: string;

  @IsString()
  @IsNotEmpty()
  server: string;
}
