import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { QuotaService } from './quota.service';

@Global()
@Module({
  providers: [PrismaService, QuotaService],
  exports: [PrismaService, QuotaService],
})
export class PrismaModule {}
