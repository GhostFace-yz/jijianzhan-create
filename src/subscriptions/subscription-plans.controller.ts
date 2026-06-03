import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Subscriptions')
@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '获取订阅计划列表' })
  findAll() {
    return this.subscriptionsService.findAllPlans();
  }
}
