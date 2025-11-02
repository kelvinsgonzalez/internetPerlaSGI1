import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto';

@UseGuards(AuthGuard('jwt'))
@Controller('messages')
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Get('contacts')
  list(@Req() req: any) {
    return this.service.listContacts(req.user.userId);
  }

  @Get('thread/:contactId')
  thread(@Req() req: any, @Param('contactId') contactId: string) {
    return this.service.getThread(req.user.userId, contactId);
  }

  @Post('send')
  send(@Req() req: any, @Body() dto: SendMessageDto) {
    return this.service.sendMessage(req.user.userId, dto);
  }
}
