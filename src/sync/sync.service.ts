import { Injectable, ConflictException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { SheetSyncJobResult } from './sync.processor';

export interface EnqueueResult {
  jobId: string;
  message: string;
}

export interface JobStatusResult {
  jobId: string;
  state: 'active' | 'waiting' | 'completed' | 'failed' | 'delayed' | 'unknown';
  progress: number;
  result: SheetSyncJobResult | null;
  failReason: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}

@Injectable()
export class SyncService {
  constructor(
    @InjectQueue('sheet-sync') private readonly syncQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  async triggerSync(triggeredBy: string): Promise<EnqueueResult> {
    const [active, waiting] = await Promise.all([
      this.syncQueue.getActive(),
      this.syncQueue.getWaiting(),
    ]);

    if (active.length > 0 || waiting.length > 0) {
      const runningJob = active[0] ?? waiting[0];
      throw new ConflictException(
        `A sync is already in progress (job ${runningJob.id}). ` +
        `Check status at GET /admin/sync/status/${runningJob.id}`,
      );
    }

    const spreadsheetId = this.config.get<string>(
      'GOOGLE_SPREADSHEET_ID',
      '1KtveBZ3Hn3ex2H5iV1BGF-nlahE9r45DkPP1vLNkkP8',
    );

    const job = await this.syncQueue.add(
      'sync-voters',
      { spreadsheetId, triggeredBy },
      {
        attempts: 1,
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      },
    );

    return {
      jobId: String(job.id),
      message: `Sync job enqueued. Poll GET /admin/sync/status/${job.id} for progress.`,
    };
  }

  async getJobStatus(jobId: string): Promise<JobStatusResult> {
    const job = await this.syncQueue.getJob(jobId);
    if (!job) {
      return {
        jobId,
        state: 'unknown',
        progress: 0,
        result: null,
        failReason: null,
        startedAt: null,
        finishedAt: null,
      };
    }

    const state = await job.getState();
    return {
      jobId,
      state: state as JobStatusResult['state'],
      progress: typeof job.progress === 'number' ? job.progress : 0,
      result: state === 'completed' ? (job.returnvalue as SheetSyncJobResult) : null,
      failReason: state === 'failed' ? (job.failedReason ?? null) : null,
      startedAt: job.processedOn ?? null,
      finishedAt: job.finishedOn ?? null,
    };
  }
}
