import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { SignInDto } from './dto/signin.dto';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async signIn(signInDto: SignInDto) {
    const user = this.usersService.findOneByNick(signInDto.nick);
    if (!user) throw new UnauthorizedException('User not found');
    // TODO: return script name, role names
    return user;
  }
}
