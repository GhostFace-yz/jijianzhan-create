import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Headers,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { GenerationTaskService } from './generation-task.service';
import { CreateGenerationTaskDto } from './dto/create-generation-task.dto';
import { WebhookCallbackDto } from './dto/webhook-callback.dto';
import { GenerationTaskResponseDto } from './dto/generation-task-response.dto';

@ApiTags('Generation Tasks')
@Controller()
export class GenerationTasksController {
  constructor(
    private readonly generationTaskService: GenerationTaskService,
    private readonly configService: ConfigService,
  ) {}

  @Post('generation-tasks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '提交图片/视频生成任务' })
  async create(
    @Body() dto: CreateGenerationTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GenerationTaskResponseDto> {
    return this.generationTaskService.submitTask({
      messageId: dto.messageId,
      userId: user.id,
      type: dto.type,
      params: dto.params,
    });
  }

  @Get('generation-tasks/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询生成任务状态与结果' })
  @ApiParam({ name: 'id', description: '任务 ID' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GenerationTaskResponseDto> {
    return this.generationTaskService.getTask(id, user.id);
  }

  @Post('generation-tasks/:id/retry')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: '重试失败的任务' })
  @ApiParam({ name: 'id', description: '任务 ID' })
  async retry(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GenerationTaskResponseDto> {
    const retried = await this.generationTaskService.retryTask(id, user.id);
    // Re-submit to Agnes AI
    return this.generationTaskService.resubmitToAgnes(retried.id, user.id);
  }

  @Post('internal/webhooks/generation-callback')
  @Public()
  @HttpCode(204)
  @ApiOperation({ summary: 'Agnes AI 生成服务回调（内部）' })
  @ApiHeader({
    name: 'X-Webhook-Secret',
    description: 'Webhook 密钥',
    required: true,
  })
  async handleWebhook(
    @Body() dto: WebhookCallbackDto,
    @Headers('x-webhook-secret') secret: string,
  ): Promise<void> {
    const expectedSecret = this.configService.get<string>('WEBHOOK_SECRET');
    if (expectedSecret && secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    await this.generationTaskService.handleWebhookCallback(
      dto.provider_task_id,
      dto.status,
      dto.result_url,
      dto.error_message,
    );
  }
}
