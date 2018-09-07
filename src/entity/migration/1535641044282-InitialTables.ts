import {MigrationInterface, QueryRunner} from "typeorm";

export class InitialTables1535641044282 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "project" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdDate" TIMESTAMP NOT NULL DEFAULT now(), "title" character varying NOT NULL, "description" character varying NOT NULL, CONSTRAINT "PK_4d68b1358bb5b766d3e78f32f57" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "version" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "title" character varying NOT NULL, "abi" character varying NOT NULL, "bytecode" character varying, CONSTRAINT "PK_4fb5fbb15a43da9f35493107b1d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "network" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "connection_string" character varying NOT NULL, "description" character varying NOT NULL, CONSTRAINT "PK_8f8264c2d37cbbd8282ee9a3c97" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "contract" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "versionId" uuid NOT NULL, "networkId" uuid NOT NULL, "address" character varying, "deploy_date" TIMESTAMP, "deploy_tx_id" character varying, "deploy_author" character varying, CONSTRAINT "PK_17c3a89f58a2997276084e706e8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "event_subscription" ("url" character varying NOT NULL, "project" character varying NOT NULL, "eventNames" text NOT NULL, "lastBlock" bigint NOT NULL, "interval" integer NOT NULL, "errorCount" integer NOT NULL, "createdDate" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c2a1181e1ab540267b19ee9f7fd" PRIMARY KEY ("url"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "storage_credential" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdDate" TIMESTAMP NOT NULL DEFAULT now(), "title" character varying, "driver_type" text NOT NULL, "base_path" text NOT NULL, "options" text NOT NULL, CONSTRAINT "PK_21a1098f324ae04264395274bcf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "wallet" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdDate" TIMESTAMP NOT NULL DEFAULT now(), "title" character varying, "public_key" text NOT NULL, "address" text NOT NULL, "private_key" text NOT NULL, CONSTRAINT "PK_bec464dd8d54c39c54fd32e2334" PRIMARY KEY ("id"))`);

        await queryRunner.query(`ALTER TABLE "version" DROP CONSTRAINT IF EXISTS "FK_87cc47dae583fb8cc5e43e70009";`);
        await queryRunner.query(`ALTER TABLE "contract" DROP CONSTRAINT IF EXISTS "FK_cdf9e5249da1cc1040a79eb2ed1";`);
        await queryRunner.query(`ALTER TABLE "contract" DROP CONSTRAINT IF EXISTS "FK_97c295731e5fd33907575dffa0f";`);
        await queryRunner.query(`ALTER TABLE "contract" DROP CONSTRAINT IF EXISTS "FK_b8ee4adea6e3668809e6757dc93";`);

        await queryRunner.query(`ALTER TABLE "version" ADD CONSTRAINT "FK_87cc47dae583fb8cc5e43e70009" FOREIGN KEY ("projectId") REFERENCES "project"("id")`);
        await queryRunner.query(`ALTER TABLE "contract" ADD CONSTRAINT "FK_cdf9e5249da1cc1040a79eb2ed1" FOREIGN KEY ("projectId") REFERENCES "project"("id")`);
        await queryRunner.query(`ALTER TABLE "contract" ADD CONSTRAINT "FK_97c295731e5fd33907575dffa0f" FOREIGN KEY ("versionId") REFERENCES "version"("id")`);
        await queryRunner.query(`ALTER TABLE "contract" ADD CONSTRAINT "FK_b8ee4adea6e3668809e6757dc93" FOREIGN KEY ("networkId") REFERENCES "network"("id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "contract" DROP CONSTRAINT "FK_b8ee4adea6e3668809e6757dc93"`);
        await queryRunner.query(`ALTER TABLE "contract" DROP CONSTRAINT "FK_97c295731e5fd33907575dffa0f"`);
        await queryRunner.query(`ALTER TABLE "contract" DROP CONSTRAINT "FK_cdf9e5249da1cc1040a79eb2ed1"`);
        await queryRunner.query(`ALTER TABLE "version" DROP CONSTRAINT "FK_87cc47dae583fb8cc5e43e70009"`);
        await queryRunner.query(`DROP TABLE "wallet"`);
        await queryRunner.query(`DROP TABLE "storage_credential"`);
        await queryRunner.query(`DROP TABLE "event_subscription"`);
        await queryRunner.query(`DROP TABLE "contract"`);
        await queryRunner.query(`DROP TABLE "network"`);
        await queryRunner.query(`DROP TABLE "version"`);
        await queryRunner.query(`DROP TABLE "project"`);
    }

}
