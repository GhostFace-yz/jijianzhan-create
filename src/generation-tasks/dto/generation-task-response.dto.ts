import { ApiProperty } from '@nestjs/swagger';
import { GenerationType, GenerationStatus, Prisma } from '@prisma/client';

export class GenerationTaskResponseDto {
  @ApiProperty({ description: '任务 ID', example: 'clwt123abc' })
  id: string;

  @ApiProperty({ description: '关联消息 ID', example: 'msg456def' })
  messageId: string;

  @ApiProperty({ description: '用户 ID', example: 'user789ghi' })
  userId: string;

  @ApiProperty({ description: '生成类型', enum: GenerationType })
  type: GenerationType;

  @ApiProperty({
    description: '服务商任务 ID',
    nullable: true,
    example: 'agnes-task-123',
  })
  providerTaskId: string | null;

  @ApiProperty({ description: '任务状态', enum: GenerationStatus })
  status: GenerationStatus;

  @ApiProperty({
    description: '结果 URL',
    nullable: true,
    format: 'uri',
    example: 'https://cdn.example.com/result.png',
  })
  resultUrl: string | null;

  @ApiProperty({
    description: '生成参数',
    required: false,
    additionalProperties: true,
    example: { prompt: 'A cat in space' },
  })
  params?: Prisma.JsonValue | null;

  @ApiProperty({
    description: '错误信息',
    nullable: true,
    example: 'Generation failed',
  })
  errorMessage: string | null;

  @ApiProperty({
    description: '进度百分比',
    minimum: 0,
    maximum: 100,
    nullable: true,
    example: 75,
  })
  progress: number | null;

  @ApiProperty({ description: '创建时间', format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间', format: 'date-time' })
  updatedAt: Date;
}
