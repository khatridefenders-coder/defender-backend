import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFCardNo1777800000002 implements MigrationInterface {
  name = 'AddFCardNo1777800000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "voters" ADD COLUMN IF NOT EXISTS "fCardNo" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "voters" DROP COLUMN IF EXISTS "fCardNo"`);
  }
}
