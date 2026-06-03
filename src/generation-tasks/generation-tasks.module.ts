import { Module } from '@nestjs/common';
import { GenerationTasksController } from './generation-tasks.controller';
import { GenerationTaskService } from './generation-task.service';
import { AgnesProvider } from './agnes.provider';

@Module({
  controllers: [GenerationTasksController],
  providers: [GenerationTaskService, AgnesProvider],
  exports: [GenerationTaskService],
})
export class GenerationTasksModule {}
