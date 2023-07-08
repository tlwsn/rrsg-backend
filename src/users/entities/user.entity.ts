import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

export enum Role {
  COMMANDER = 1,
  FIGHTER = 2,
  TRAINEE = 3,
}

@Schema({ timestamps: true })
export class User {
  @ApiProperty({ example: 'Thomas_Lawson' })
  @Prop({ unique: true })
  nick: string;

  @ApiProperty({ example: 'Бима' })
  @Prop()
  callsign: string;

  @ApiProperty()
  @Prop()
  online: number;

  @ApiProperty({ enum: Role })
  @Prop({ enum: Role })
  role: Role;

  @ApiProperty()
  @Prop()
  createdAt: Date;

  @ApiProperty()
  @Prop()
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
