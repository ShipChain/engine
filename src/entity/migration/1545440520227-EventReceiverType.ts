import {MigrationInterface, QueryRunner} from "typeorm";

export class EventReceiverType1545440520227 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "event_subscription" ADD "receiverType" character varying default 'POST'`);
        await queryRunner.query(`ALTER TABLE "event_subscription" ALTER COLUMN "receiverType" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "event_subscription" ALTER COLUMN "receiverType" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "event_subscription" DROP COLUMN "receiverType"`);
    }

}
