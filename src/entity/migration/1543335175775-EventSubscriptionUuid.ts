import {MigrationInterface, QueryRunner} from "typeorm";

export class EventSubscriptionUuid1543335175775 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "event_subscription" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "event_subscription" DROP CONSTRAINT "PK_c2a1181e1ab540267b19ee9f7fd"`);
        await queryRunner.query(`ALTER TABLE "event_subscription" ADD CONSTRAINT "PK_d697322379ee2faa67234d63c52" PRIMARY KEY ("url", "id")`);
        await queryRunner.query(`ALTER TABLE "event_subscription" DROP CONSTRAINT "PK_d697322379ee2faa67234d63c52"`);
        await queryRunner.query(`ALTER TABLE "event_subscription" ADD CONSTRAINT "PK_30cfa3a4d386691fef4c5995085" PRIMARY KEY ("id")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "URL_PROJECT_INDEX" ON "event_subscription"("url", "project") `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "URL_PROJECT_INDEX"`);
        await queryRunner.query(`ALTER TABLE "event_subscription" DROP CONSTRAINT "PK_30cfa3a4d386691fef4c5995085"`);
        await queryRunner.query(`ALTER TABLE "event_subscription" ADD CONSTRAINT "PK_d697322379ee2faa67234d63c52" PRIMARY KEY ("url", "id")`);
        await queryRunner.query(`ALTER TABLE "event_subscription" DROP CONSTRAINT "PK_d697322379ee2faa67234d63c52"`);
        await queryRunner.query(`ALTER TABLE "event_subscription" ADD CONSTRAINT "PK_c2a1181e1ab540267b19ee9f7fd" PRIMARY KEY ("url")`);
        await queryRunner.query(`ALTER TABLE "event_subscription" DROP COLUMN "id"`);
    }

}
