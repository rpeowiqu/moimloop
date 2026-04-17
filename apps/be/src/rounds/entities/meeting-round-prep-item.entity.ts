import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { MeetingRound } from "./meeting-round.entity";
import { MeetingMember } from "../../meetings/entities/meeting-member.entity";

@Entity('meeting_round_prep_items')
export class MeetingRoundPrepItem {

  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id!: string;

  @ManyToOne(() => MeetingRound, meetingRound => meetingRound.prepItems, {
    nullable: false,
  })
  meetingRound!: MeetingRound;

  @ManyToOne(() => MeetingMember, meetingMember => meetingMember.prepItems)
  meetingMember!: MeetingMember | null;

  @Column({
    type: 'text',
  })
  description!: string | null;

  @Column({
    name: 'sort_order',
    type: 'smallint',
    nullable: false,
    default: 1,
  })
  sortOrder!: number;

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