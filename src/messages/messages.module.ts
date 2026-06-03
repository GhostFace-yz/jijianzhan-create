import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { KimiProvider } from './kimi.provider';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, KimiProvider],
  exports: [MessagesService],
})
export class MessagesModule {}
