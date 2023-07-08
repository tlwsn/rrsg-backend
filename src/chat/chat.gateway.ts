import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UsersService } from 'src/users/users.service';
import * as ws from 'ws';
import { Document, Types } from 'mongoose';
import { User } from 'src/users/entities/user.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

type WSStore = {
  state: { nick?: string; server?: string };
} & ws;

type TUser = Document<unknown, object, User> &
  Omit<
    User & {
      _id: Types.ObjectId;
    },
    never
  >;

interface IMessage {
  auth?: boolean;
  chat?: boolean;
  users?: boolean;
  nick: string;
  server?: string;
  text?: string;
  updateOnline?: boolean;
  myOnline?: boolean;
}

function convertHMS(sec: number) {
  const hours: number = Math.floor(sec / 3600); // get hours
  const minutes: number = Math.floor((sec - hours * 3600) / 60); // get minutes
  const seconds: number = sec - hours * 3600 - minutes * 60; //  get seconds
  // add 0 if value < 10; Example: 2 => 02
  const hoursString = hours < 10 ? '0' + hours : hours;
  const minutesString = minutes < 10 ? '0' + minutes : minutes;
  const secondsString = seconds < 10 ? '0' + seconds : seconds;

  return hoursString + ':' + minutesString + ':' + secondsString;
}

@WebSocketGateway()
export class ChatGateway
  implements OnGatewayConnection<WSStore>, OnGatewayDisconnect<WSStore>
{
  constructor(private usersService: UsersService) {}

  @WebSocketServer() private server: ws.Server;
  private clients: Array<WSStore> = [];
  private users: {
    [nick: string]: {
      online: number;
      updateDate: Date;
    };
  };

  handleConnection(client: WSStore) {
    client.state = {};
    this.clients.push(client);

    client.on('message', this.handleMessage);

    throw new Error('Method not implemented.');
  }

  handleDisconnect(client: WSStore) {
    const index = this.clients.findIndex((el) => el == client);
    if (index >= 0) this.clients.splice(index, 1);
  }

  private async handleMessage(client: WSStore, message: ws.RawData) {
    const data: IMessage = JSON.parse(message.toString());
    if (!data) return;
    let user: TUser;

    if (data.nick) {
      user = await this.usersService.findOneByNick(data.nick);
      if (!user) return client.send(JSON.stringify({ noAccess: true }));
    }

    if (data.auth) return this.handleAuth(data);
    if (data.chat) return this.handleChat(data, user);
    if (data.users) return this.handleUsers(client);
    if (data.updateOnline) return this.handleUpdateOnline(data);
    if (data.myOnline) return this.myOnline(client, data, user);
  }

  private handleAuth(data: IMessage) {
    const userIndex = this.clients.findIndex(
      (client) => client.state.nick == data.nick,
    );
    if (userIndex >= 0) {
      this.clients[userIndex].terminate();
      this.clients.splice(userIndex, 1);
    }
  }

  private async handleChat(data: IMessage, user: TUser) {
    const text = data.text.replace(/{\w+}/g, '');

    this.sendMessageToAll(
      `${data.nick} | ${user.callsign}: ${
        user.role == 1 ? '{f70307}' : ''
      }${text}`,
    );
  }

  private async handleUsers(client: WSStore) {
    const users = await this.usersService.findAll();
    const list = this.clients.map((client) => ({
      nick: client.state.nick,
      server: client.state.server,
      callsign:
        users.find((user) => user.nick == client.state.nick).callsign ||
        'undefined',
    }));
    client.send(JSON.stringify({ users: true, list }));
  }

  private async handleUpdateOnline(data: IMessage) {
    if (!(data.nick in this.users))
      this.users[data.nick] = { online: 1, updateDate: new Date() };

    const user = this.users[data.nick];
    if (Date.now() - user.updateDate.getTime() < 1000) return;
    user.online++; // need to test
    user.updateDate = new Date();
  }

  private async myOnline(client: WSStore, data: IMessage, user: TUser) {
    let online = user.online;
    if (data.nick in this.users) online += this.users[data.nick].online;
    client.send(
      JSON.stringify({
        myOnline: true,
        dayOnline: convertHMS(online),
      }),
    );
  }

  private sendMessageToAll(text: string) {
    this.clients.forEach((client) => {
      if (client.state.nick) client.send(JSON.stringify({ chat: true, text }));
    });
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  updateUsers() {
    const users = Object.keys(this.users);
    users.forEach((user) => {
      this.usersService.updateOnline(user, this.users[user].online);
    });
  }
}
