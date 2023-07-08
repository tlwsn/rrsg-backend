import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UsersService } from 'src/users/users.service';
import * as ws from 'ws';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger, OnModuleInit } from '@nestjs/common';
import { AuthDto } from './dto/auth.dto';
import { ChatDto } from './dto/chat.dto';
import { Role } from 'src/users/entities/user.entity';

type WSStore = {
  state: { nick?: string; server?: string };
} & ws;

interface INewMessage {
  auth?: AuthDto;
  chat?: ChatDto;
  users?: boolean;
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
  implements
    OnGatewayConnection<WSStore>,
    OnGatewayDisconnect<WSStore>,
    OnModuleInit
{
  constructor(private usersService: UsersService) {}

  @WebSocketServer() private server: ws.Server;
  private clients: Array<WSStore> = [];
  private users: {
    [nick: string]: {
      online: number;
      updateDate: Date;
    };
  } = {};
  private logger = new Logger(ChatGateway.name);

  onModuleInit() {
    this.server.on('error', (error) => {
      this.logger.error(error);
    });
  }

  handleConnection(client: WSStore) {
    client.state = {};
    this.clients.push(client);

    client.on('message', async (message) =>
      this.handleMessage(client, message),
    );

    client.on('error', (error) => {
      this.logger.error(error);
    });
  }

  handleDisconnect(client: WSStore) {
    const index = this.clients.findIndex((el) => el == client);
    if (index >= 0) this.clients.splice(index, 1);
  }

  private async handleMessage(client: WSStore, message: ws.RawData) {
    const data: INewMessage = JSON.parse(message.toString());
    if (!data) return;

    if (data.auth) return this.handleAuth(client, data.auth);

    if (!client.state.nick) return;

    if (data.chat) return this.handleChat(client, data.chat);
    if (data.users) return this.handleUsers(client);
    if (data.updateOnline) return this.handleUpdateOnline(client);
    if (data.myOnline) return this.myOnline(client);
  }

  private handleAuth(client: WSStore, data: AuthDto) {
    const userIndex = this.clients.findIndex(
      (client) => client.state.nick == data.nick,
    );
    if (userIndex >= 0) {
      this.clients[userIndex].terminate();
      this.clients.splice(userIndex, 1);
    }
    client.state.nick = data.nick;
    client.state.server = data.server;
  }

  private async handleChat(client: WSStore, data: ChatDto) {
    const nick = client.state.nick;
    const user = await this.usersService.findOneByNick(nick);
    const text = data.text.replace(/{\w+}/g, '');

    this.sendMessageToAll(
      `${nick} | ${user.callsign}: ${
        user.role == Role.COMMANDER ? '{f70307}' : ''
      }${text}`,
    );
  }

  private async handleUsers(client: WSStore) {
    const users = await this.usersService.findAll();
    const list = this.clients.map((client) => ({
      nick: client.state?.nick,
      server: client.state?.server,
      callsign:
        users.find((user) => user.nick == client.state?.nick)?.callsign ||
        'undefined',
    }));
    client.send(JSON.stringify({ users: true, list }));
  }

  private async handleUpdateOnline(client: WSStore) {
    if (!(client.state.nick in this.users))
      this.users[client.state.nick] = { online: 1, updateDate: new Date() };

    const user = this.users[client.state.nick];
    if (Date.now() - user.updateDate.getTime() < 1000) return;
    user.online++; // need to test
    user.updateDate = new Date();
  }

  private async myOnline(client: WSStore) {
    const nick = client.state.nick;
    const user = await this.usersService.findOneByNick(nick);
    let online = user.online;
    if (nick in this.users) online += this.users[nick].online;
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
