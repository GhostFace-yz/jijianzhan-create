import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DowngradeSubscriptionDto {
  @ApiProperty({ description: '目标订阅计划 ID', example: 'plan_free' })
  @IsString()
  planId: string;
}
