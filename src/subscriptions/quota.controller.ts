import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@ApiTags('Quota')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quota')
export class QuotaController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: '获取当前额度与用量' })
  getQuota(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getQuota(user.id);
  }
}
