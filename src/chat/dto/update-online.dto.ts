import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateOnlineDto {
  @IsString()
  @IsNotEmpty()
  nick: string;
}
