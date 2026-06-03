import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsObject,
} from 'class-validator';
import { GenerationType } from '@prisma/client';

export class CreateGenerationTaskDto {
  @ApiProperty({
    description: '关联的消息 ID',
    example: 'clwt123abc',
  })
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @ApiProperty({
    description: '生成类型',
    enum: GenerationType,
    example: GenerationType.IMAGE,
  })
  @IsEnum(GenerationType)
  type: GenerationType;

  @ApiProperty({
    description: '生成参数（如 prompt、aspect_ratio 等）',
    required: false,
    example: { prompt: 'A cat in space', aspect_ratio: '16:9' },
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
