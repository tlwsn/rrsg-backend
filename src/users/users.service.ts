import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as moment from 'moment-timezone';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  create(createUserDto: CreateUserDto) {
    const user = new this.userModel(createUserDto);
    return user.save();
  }

  findAll() {
    return this.userModel.find({});
  }

  findOneByNick(nick: string) {
    return this.userModel.findOne({ nick });
  }

  findOneById(id: string) {
    return this.userModel.findById(id);
  }

  update(id: string, updateUserDto: UpdateUserDto) {
    return this.userModel.findByIdAndUpdate(
      id,
      { $set: updateUserDto },
      { new: true },
    );
  }

  remove(id: string) {
    return this.userModel.findByIdAndRemove(id);
  }

  updateOnline(nick: string, online: number) {
    return this.userModel.findOneAndUpdate(
      { nick },
      { $inc: { online } },
      { new: true, upsert: false },
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  resetOnline() {
    const now = moment().tz('Europe/Moscow');
    if (now.hour() != 0) return;
    this.userModel.updateMany(
      {},
      {
        $set: { online: 0 },
      },
    );
  }
}
