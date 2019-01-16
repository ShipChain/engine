import {MigrationInterface, QueryRunner} from "typeorm";

export class RemoveNetworkConnectionString1545160204290 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "network" DROP COLUMN "connection_string"`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "network" ADD "connection_string" character varying NOT NULL`);
    }

}
