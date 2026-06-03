import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsUrl } from 'class-validator';
import { GenerationStatus } from '@prisma/client';

export class WebhookCallbackDto {
  @ApiProperty({
    description: 'Agnes AI 侧的任务 ID',
    example: 'agnes-task-123',
  })
  @IsString()
  @IsNotEmpty()
  provider_task_id: string;

  @ApiProperty({
    description: '任务状态',
    enum: GenerationStatus,
    example: GenerationStatus.COMPLETED,
  })
  @IsEnum(GenerationStatus)
  status: GenerationStatus;

  @ApiProperty({
    description: '生成结果 URL',
    required: false,
    example: 'https://cdn.example.com/result.png',
  })
  @IsOptional()
  @IsUrl()
  result_url?: string;

  @ApiProperty({
    description: '错误信息',
    required: false,
    example: 'Generation failed due to content policy',
  })
  @IsOptional()
  @IsString()
  error_message?: string;
}
