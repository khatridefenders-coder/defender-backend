import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema migration — creates all three tables from scratch.
 *
 * Tables created:
 *   users        — Admins and Voting Coordinators
 *   voters       — Community voter records
 *   app_settings — Single-row global settings (markingEnabled flag)
 */
export class InitialSetup1777800000000 implements MigrationInterface {
  name = 'InitialSetup1777800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------
    // Role enum
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum" AS ENUM ('admin', 'coordinator')
    `);

    // ------------------------------------------------------------------
    // users
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
        "username"           character varying        NOT NULL,
        "passwordHash"       character varying        NOT NULL,
        "role"               "public"."users_role_enum" NOT NULL,
        "fullName"           character varying        NOT NULL,
        "phone"              character varying,
        "mustChangePassword" boolean                  NOT NULL DEFAULT true,
        "createdAt"          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_username"  UNIQUE      ("username"),
        CONSTRAINT "PK_users"           PRIMARY KEY ("id")
      )
    `);

    // ------------------------------------------------------------------
    // voters
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "voters" (
        "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
        "memberName"      character varying,
        "fatherName"      character varying,
        "orakh"           character varying,
        "fullName"        character varying        NOT NULL,
        "cardNo"          character varying,
        "phone"           character varying,
        "address"         character varying,
        "pollingStation"  character varying,
        "isArrived"       boolean                  NOT NULL DEFAULT false,
        "markedArrivedBy" character varying,
        "arrivedAt"       TIMESTAMP WITH TIME ZONE,
        "coordinatorId"   uuid,
        "createdAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_voters" PRIMARY KEY ("id")
      )
    `);

    // ------------------------------------------------------------------
    // app_settings  (single-row table, id is always 1)
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "app_settings" (
        "id"             integer                  NOT NULL,
        "markingEnabled" boolean                  NOT NULL DEFAULT true,
        "updatedAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_settings" PRIMARY KEY ("id")
      )
    `);

    // Seed the single settings row so the app always finds it
    await queryRunner.query(`
      INSERT INTO "app_settings" ("id", "markingEnabled") VALUES (1, true)
    `);

    // ------------------------------------------------------------------
    // Foreign key: voters.coordinatorId → users.id
    // ON DELETE SET NULL so deleting a coordinator doesn't orphan voters
    // ------------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "voters"
        ADD CONSTRAINT "FK_voters_coordinatorId"
        FOREIGN KEY ("coordinatorId")
        REFERENCES "users" ("id")
        ON DELETE SET NULL
        ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "voters" DROP CONSTRAINT "FK_voters_coordinatorId"`);
    await queryRunner.query(`DROP TABLE "app_settings"`);
    await queryRunner.query(`DROP TABLE "voters"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
