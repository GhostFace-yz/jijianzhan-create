import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@ApiTags('Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @ApiOperation({ summary: '创建新会话' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSessionDto,
  ) {
    return this.sessionsService.create(user.id, dto.title);
  }

  @Get()
  @ApiOperation({ summary: '查询当前用户的会话列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.sessionsService.findAll(user.id, page, pageSize);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询单个会话详情（含最近消息摘要）' })
  @ApiParam({ name: 'id', description: '会话 ID' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.sessionsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '重命名会话标题' })
  @ApiParam({ name: 'id', description: '会话 ID' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.sessionsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '软删除会话' })
  @ApiParam({ name: 'id', description: '会话 ID' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.sessionsService.remove(id, user.id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: '恢复已删除会话' })
  @ApiParam({ name: 'id', description: '会话 ID' })
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.sessionsService.restore(id, user.id);
  }
}
