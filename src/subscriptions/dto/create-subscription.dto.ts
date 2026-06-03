import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ description: '订阅计划 ID', example: 'plan_basic' })
  @IsString()
  planId: string;

  @ApiProperty({ description: '订阅周期', enum: ['monthly', 'yearly'] })
  @IsEnum(['monthly', 'yearly'] as const)
  period: 'monthly' | 'yearly';
}
