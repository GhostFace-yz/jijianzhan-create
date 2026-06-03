import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Sse,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
} from '@nestjs/common';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiProduces,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { MessagesService, SseChunk } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageListResponseDto } from './dto/message-response.dto';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @HttpCode(200)
  @Sse()
  @ApiOperation({ summary: '发送消息并接收 SSE 流式 AI 回复' })
  @ApiProduces('text/event-stream')
  sendMessage(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Observable<MessageEvent> {
    return this.messagesService
      .createMessageStream(user.id, dto)
      .pipe(
        map((chunk: SseChunk) => ({
          data: JSON.stringify(chunk),
        }) as MessageEvent),
      );
  }

  @Get()
  @ApiOperation({ summary: '查询会话历史消息列表' })
  @ApiQuery({ name: 'sessionId', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async getMessages(
    @Query('sessionId') sessionId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MessageListResponseDto> {
    return this.messagesService.getMessages(sessionId, user.id, page, pageSize);
  }
}
