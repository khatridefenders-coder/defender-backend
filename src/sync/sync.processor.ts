import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Voter } from '../entities/voter.entity';
import { Role } from '../common/enums/role.enum';
import { fetchSheetCSV, buildHeaderMap, toUsername } from '../common/utils/sheets.util';

export interface SheetSyncJobData {
  spreadsheetId: string;
  triggeredBy: string;
}

export interface SheetSyncJobResult {
  coordinatorsCreated: number;
  coordinatorsUpdated: number;
  votersCreated: number;
  votersUpdated: number;
  skipped: number;
  durationMs: number;
}

const COORD_PASSWORD = 'Defender@2026';
const CHUNK_SIZE = 200;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

@Processor('sheet-sync', { concurrency: 1 })
export class SyncProcessor extends WorkerHost {
  constructor(
    @InjectRepository(User)  private readonly userRepo: Repository<User>,
    @InjectRepository(Voter) private readonly voterRepo: Repository<Voter>,
  ) {
    super();
  }

  async process(job: Job<SheetSyncJobData, SheetSyncJobResult>): Promise<SheetSyncJobResult> {
    const startMs = Date.now();
    let coordinatorsCreated = 0;
    let coordinatorsUpdated = 0;
    let votersCreated = 0;
    let votersUpdated = 0;
    let skipped = 0;

    // -------------------------------------------------------------------------
    // Phase 1: Fetch CSV from Google Sheets
    // -------------------------------------------------------------------------
    await job.updateProgress(0);
    const rows = await fetchSheetCSV('voters', job.data.spreadsheetId);
    if (rows.length < 3) throw new Error('Sheet "voters" is empty or header-only.');

    // Rows 0-1 are blank/title rows; actual column headers are in row 2.
    // Column 1 (UniqueCardNo) has no header text — accessed by index directly.
    const headers  = buildHeaderMap(rows[2]);
    const dataRows = rows.slice(3);
    const col = (row: string[], name: string) =>
      (row[headers.get(name) ?? -1] ?? '').trim();

    await job.updateProgress(10);

    // -------------------------------------------------------------------------
    // Phase 2: Coordinator upsert
    // -------------------------------------------------------------------------
    const uniqueCoordNames = [
      ...new Set(dataRows.map((r) => col(r, 'Voting Coordinator')).filter(Boolean)),
    ];

    await job.updateProgress(15);

    const coordMap = new Map<string, User>();

    for (const name of uniqueCoordNames) {
      const username = toUsername(name);
      const existing = await this.userRepo.findOne({ where: { username } });

      if (!existing) {
        const passwordHash = await bcrypt.hash(COORD_PASSWORD, 10);
        const newUser = await this.userRepo.save(
          this.userRepo.create({
            username,
            fullName: name,
            passwordHash,
            role: Role.COORDINATOR,
            mustChangePassword: true,
          }),
        );
        coordMap.set(username, newUser);
        coordinatorsCreated++;
      } else {
        // Only update fullName — never touch passwordHash or mustChangePassword
        await this.userRepo.update({ id: existing.id }, { fullName: name });
        coordMap.set(username, existing);
        coordinatorsUpdated++;
      }
    }

    await job.updateProgress(25);

    // -------------------------------------------------------------------------
    // Phase 3: Load existing voters into memory (match key: cardNo)
    // -------------------------------------------------------------------------
    const existingVoters = await this.voterRepo
      .createQueryBuilder('v')
      .select(['v.id', 'v.cardNo'])
      .where('v.cardNo IS NOT NULL')
      .getMany();

    const existingMap = new Map(existingVoters.map((v) => [v.cardNo, v.id]));

    await job.updateProgress(30);

    // -------------------------------------------------------------------------
    // Phase 4: Classify sheet rows → toUpdate / toInsert
    // -------------------------------------------------------------------------
    type UpdateRow = {
      id: string;
      memberName: string | null;
      fatherName: string | null;
      orakh: string | null;
      fullName: string;
      fCardNo: string | null;
      phone: string | null;
      coordinatorId: string | null;
      sheetRowIndex: number;
    };

    const toUpdate: UpdateRow[] = [];
    const toInsert: Partial<Voter>[] = [];

    for (const row of dataRows) {
      const memberName = col(row, 'MemberName') || null;
      const fatherName = col(row, 'FatherName') || null;
      const orakh      = col(row, 'Orakh')       || null;
      const fullName   = [memberName, fatherName, orakh].filter(Boolean).join(' ');
      const fCardNo    = (row[0] ?? '').trim()   || null;  // col 0 = FCardNo
      const cardNo     = (row[1] ?? '').trim()   || null;  // col 1 = UniqueCardNo (no header text)
      const phone      = col(row, 'Mobile')       || null;
      const coordName  = col(row, 'Voting Coordinator');
      const coordId    = coordName
        ? (coordMap.get(toUsername(coordName))?.id ?? null)
        : null;

      if (!fullName) { skipped++; continue; }

      const sheetRowIndex = dataRows.indexOf(row);

      if (cardNo && existingMap.has(cardNo)) {
        toUpdate.push({
          id: existingMap.get(cardNo)!,
          memberName, fatherName, orakh, fullName, fCardNo, phone,
          coordinatorId: coordId,
          sheetRowIndex,
        });
        votersUpdated++;
      } else {
        toInsert.push(
          this.voterRepo.create({
            memberName, fatherName, orakh, fullName, fCardNo, cardNo, phone,
            coordinatorId: coordId,
            sheetRowIndex,
          }),
        );
        votersCreated++;
      }
    }

    // -------------------------------------------------------------------------
    // Phase 5: Execute updates in chunks (isArrived/markedArrivedBy NOT touched)
    // -------------------------------------------------------------------------
    const updateChunks = chunk(toUpdate, CHUNK_SIZE);
    for (let i = 0; i < updateChunks.length; i++) {
      await Promise.all(
        updateChunks[i].map((v) =>
          this.voterRepo.update({ id: v.id }, {
            memberName:    v.memberName,
            fatherName:    v.fatherName,
            orakh:         v.orakh,
            fullName:      v.fullName,
            fCardNo:       v.fCardNo,
            phone:         v.phone,
            coordinatorId: v.coordinatorId,
            sheetRowIndex: v.sheetRowIndex,
          }),
        ),
      );
      const pct = 30 + Math.round(((i + 1) / Math.max(updateChunks.length, 1)) * 35);
      await job.updateProgress(Math.min(pct, 65));
    }

    // -------------------------------------------------------------------------
    // Phase 6: Execute inserts in chunks
    // -------------------------------------------------------------------------
    const insertChunks = chunk(toInsert, CHUNK_SIZE);
    for (let i = 0; i < insertChunks.length; i++) {
      await this.voterRepo.save(insertChunks[i]);
      const pct = 65 + Math.round(((i + 1) / Math.max(insertChunks.length, 1)) * 30);
      await job.updateProgress(Math.min(pct, 95));
    }

    await job.updateProgress(100);

    return {
      coordinatorsCreated,
      coordinatorsUpdated,
      votersCreated,
      votersUpdated,
      skipped,
      durationMs: Date.now() - startMs,
    };
  }
}
