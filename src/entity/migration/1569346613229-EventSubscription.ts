import {MigrationInterface, QueryRunner} from "typeorm";

export class EventSubscription1569346613229 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`TRUNCATE TABLE "event_subscription"`);
        await queryRunner.query(`DROP INDEX "URL_PROJECT_INDEX"`);
        await queryRunner.query(`ALTER TABLE "event_subscription" ADD "version" character varying NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "URL_PROJECT_INDEX" ON "event_subscription"  ("url", "project", "version") `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "URL_PROJECT_INDEX"`);
        await queryRunner.query(`ALTER TABLE "event_subscription" DROP COLUMN "version"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "URL_PROJECT_INDEX" ON "event_subscription"  ("url", "project") `);
    }

}
