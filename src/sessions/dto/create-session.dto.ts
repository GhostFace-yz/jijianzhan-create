import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ description: '会话标题', required: false, example: '新对话' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;
}
