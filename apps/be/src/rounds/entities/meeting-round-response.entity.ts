import { Column, CreateDateColumn, Entity, ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { MeetingRound } from "./meeting-round.entity";
import { MeetingMember } from "../../meetings/entities/meeting-member.entity";
import { MeetingResponse } from "@repo/shared";

@Entity('meeting_round_responses')
export class MeetingRoundResponse {

  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id!: string;

  @ManyToOne(() => MeetingRound, meetingRound => meetingRound.responses, {
    nullable: false,
  })
  meetingRound!: MeetingRound;

  @OneToOne(() => MeetingMember, meetingMember => meetingMember.response, {
    nullable: false,
  })
  meetingMember!: MeetingMember;

  @Column({
    type: 'enum',
    enum: MeetingResponse,
    nullable: false,
    default: MeetingResponse.ATTEND,
  })
  response!: MeetingResponse;

  @Column({
    type: 'varchar',
    length: 300,
  })
  comment!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

}