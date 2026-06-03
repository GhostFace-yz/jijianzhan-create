import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { DowngradeSubscriptionDto } from './dto/downgrade-subscription.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('current')
  @ApiOperation({ summary: '获取当前订阅状态' })
  findCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.findCurrentSubscription(user.id);
  }

  @Post()
  @ApiOperation({ summary: '创建/升级订阅' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionsService.createSubscription(user.id, dto);
  }

  @Post('downgrade')
  @ApiOperation({ summary: '降级订阅' })
  downgrade(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DowngradeSubscriptionDto,
  ) {
    return this.subscriptionsService.downgradeSubscription(user.id, dto);
  }

  @Post('cancel')
  @ApiOperation({ summary: '取消订阅' })
  cancel(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.cancelSubscription(user.id);
  }

  @Get('bills')
  @ApiOperation({ summary: '获取账单历史' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findBills(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.subscriptionsService.findBills(user.id, page, limit);
  }
}
