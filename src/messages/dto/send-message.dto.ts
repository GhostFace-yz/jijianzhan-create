import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { MessageType } from '@prisma/client';

export class SendMessageDto {
  @ApiProperty({ description: '会话 ID', example: 'clwt123abc' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ description: '消息内容', example: '你好，请帮我写一段代码' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: '消息类型',
    enum: MessageType,
    default: MessageType.TEXT,
    required: false,
  })
  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType = MessageType.TEXT;
}
