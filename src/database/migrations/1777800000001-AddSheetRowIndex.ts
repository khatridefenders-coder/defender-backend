import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSheetRowIndex1777800000001 implements MigrationInterface {
  name = 'AddSheetRowIndex1777800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "voters" ADD COLUMN IF NOT EXISTS "sheetRowIndex" integer`);
    await queryRunner.query(`ALTER TABLE "voters" ADD COLUMN IF NOT EXISTS "fCardNo" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "voters" DROP COLUMN IF EXISTS "sheetRowIndex"`);
    await queryRunner.query(`ALTER TABLE "voters" DROP COLUMN IF EXISTS "fCardNo"`);
  }
}
