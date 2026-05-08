import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../data-source';
import { User } from '../../entities/user.entity';
import { Voter } from '../../entities/voter.entity';
import { AppSettings } from '../../entities/app-settings.entity';
import { Role } from '../../common/enums/role.enum';

// ---------------------------------------------------------------------------
// Reads from a PUBLIC Google Sheet — no API key required.
// Sheet columns: FCardNo | UniqueCardNo | MemberName | FatherName | Orakh | Mobile | Voting Coordinator
// Tab name in the spreadsheet: "voters"
// Full voter name = MemberName + FatherName + Orakh (shown as "Name" on the frontend)
// Coordinator username = auto-generated from "Voting Coordinator" column: "Ali Khan" → "ali_khan"
// ---------------------------------------------------------------------------

const ADMIN_PASSWORD = 'Admin@123';
const COORD_PASSWORD = 'Defender@2026';

import { fetchSheetCSV, buildHeaderMap, toUsername } from '../../common/utils/sheets.util';

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
async function seed() {
  await AppDataSource.initialize();
  console.log('Database connected. Seeding...\n');

  const userRepo  = AppDataSource.getRepository(User);
  const voterRepo = AppDataSource.getRepository(Voter);

  // Wipe existing data (FK order: voters first, then users)
  const settingsRepo = AppDataSource.getRepository(AppSettings);

  await AppDataSource.query('DELETE FROM voters');
  await AppDataSource.query('DELETE FROM users');
  console.log('Existing data cleared.\n');

  // Initialise the settings row (marking enabled by default)
  await settingsRepo.save(settingsRepo.create({ id: 1, markingEnabled: true }));

  const hash = (pw: string) => bcrypt.hash(pw, 10);

  // ------------------------------------------------------------------
  // 1. Admin
  // ------------------------------------------------------------------
  await userRepo.save(
    userRepo.create({
      username:           'admin',
      passwordHash:       await hash(ADMIN_PASSWORD),
      role:               Role.ADMIN,
      fullName:           'System Administrator',
      mustChangePassword: false,
    }),
  );
  console.log('Admin created: admin');

  // ------------------------------------------------------------------
  // 2. Fetch voter data from Google Sheet
  // ------------------------------------------------------------------
  console.log('\nFetching data from Google Sheet...');
  const rows = await fetchSheetCSV('voters');

  if (rows.length < 4) {
    throw new Error(
      'The "voters" sheet appears empty or has only a header row. ' +
      'Check the tab name and that the sheet has data.',
    );
  }

  // Rows 0-1 are blank/title rows; actual column headers are in row 2.
  const headers  = buildHeaderMap(rows[2]);
  const dataRows = rows.slice(3);

  console.log(`  Tab "voters" — ${dataRows.length} data rows`);
  console.log(`  Headers: ${rows[2].join(' | ')}\n`);

  const col = (row: string[], name: string): string =>
    (row[headers.get(name) ?? -1] ?? '').trim();

  // ------------------------------------------------------------------
  // 3. Extract unique coordinator names → create User accounts
  // ------------------------------------------------------------------
  const uniqueCoordNames = [
    ...new Set(
      dataRows.map((row) => col(row, 'Voting Coordinator')).filter(Boolean),
    ),
  ];

  if (uniqueCoordNames.length === 0) {
    throw new Error(
      'No values found in the "Voting Coordinator" column. ' +
      'Check the column header matches exactly.',
    );
  }

  console.log(`Creating ${uniqueCoordNames.length} coordinator accounts...`);

  const coordinators = await Promise.all(
    uniqueCoordNames.map(async (name) =>
      userRepo.save(
        userRepo.create({
          username:           toUsername(name),
          fullName:           name,
          passwordHash:       await hash(COORD_PASSWORD),
          role:               Role.COORDINATOR,
          mustChangePassword: true,
        }),
      ),
    ),
  );

  // Map: coordinator full name → saved User entity (for linking voters)
  const coordMap = new Map<string, User>(coordinators.map((c) => [c.fullName, c]));

  // ------------------------------------------------------------------
  // 4. Create voter records
  // ------------------------------------------------------------------
  console.log('\nCreating voter records...');

  const voters = dataRows
    .map((row, index) => {
      const memberName = col(row, 'MemberName');
      const fatherName = col(row, 'FatherName');
      const orakh      = col(row, 'Orakh');
      const fullName   = [memberName, fatherName, orakh].filter(Boolean).join(' ');

      if (!fullName) return null; // skip blank rows

      const coordName   = col(row, 'Voting Coordinator');
      const coordinator = coordMap.get(coordName);

      if (coordName && !coordinator) {
        console.warn(`  Warning: coordinator "${coordName}" not found for voter "${fullName}"`);
      }

      return voterRepo.create({
        memberName:    memberName || null,
        fatherName:    fatherName || null,
        orakh:         orakh      || null,
        fullName,
        fCardNo:       (row[0] ?? '').trim()    || null,  // col 0 = FCardNo
        cardNo:        (row[1] ?? '').trim()    || null,  // col 1 = UniqueCardNo (no header text)
        phone:         col(row, 'Mobile')       || null,
        coordinator:   coordinator ?? undefined,
        sheetRowIndex: index,
      });
    })
    .filter(Boolean) as Voter[];

  await voterRepo.save(voters);

  // ------------------------------------------------------------------
  // 5. Summary
  // ------------------------------------------------------------------
  console.log('\n========== Seed Complete ==========');
  console.log(`  Admin        username: admin       password: ${ADMIN_PASSWORD}`);
  coordinators.forEach((c) => {
    const count = voters.filter((v) => v.coordinator?.fullName === c.fullName).length;
    console.log(
      `  Coordinator  username: ${c.username.padEnd(22)} password: ${COORD_PASSWORD}` +
      `  voters: ${count}  (${c.fullName})`,
    );
  });
  console.log(`\n  Total voters seeded: ${voters.length}`);
  console.log('===================================\n');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('\nSeed FAILED:', err.message ?? err);
  process.exit(1);
});
