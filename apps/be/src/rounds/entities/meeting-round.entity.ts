import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Meeting } from "../../meetings/entities/meeting.entity";
import { MeetingRoundStatus } from "@repo/shared";
import { MeetingRoundMemberLinks } from "./meeting-round-member-links.entity";
import { MeetingRoundResponse } from "./meeting-round-response.entity";
import { MeetingRoundPrepItem } from "./meeting-round-prep-item.entity";

@Entity('meeting_rounds')
export class MeetingRound {

  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id!: string;

  @ManyToOne(() => Meeting, Meeting => Meeting.rounds)
  @JoinColumn({ name: 'meeting_id' })
  meeting!: Meeting;

  @Column({
    name: 'round_number',
    type: 'smallint',
    nullable: false,
    default: 1,
  })
  roundNumber!: number;

  @Column({
    type: 'varchar',
    length: 120,
    nullable: false,
  })
  title!: string;

  @Column({
    name: 'scheduled_at',
    type: 'timestamptz',
    nullable: false,
  })
  scheduledAt!: Date;

  @Column({
    type: 'varchar',
    length: 300,
    nullable: false,
  })
  location!: string;

  @Column({
    type: 'text',
  })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: MeetingRoundStatus,
    nullable: false,
    default: MeetingRoundStatus.SCHEDULED,
  })
  status!: MeetingRoundStatus;

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

  @OneToMany(() => MeetingRoundMemberLinks, MeetingRoundMemberLinks => MeetingRoundMemberLinks.meetingRound)
  meetingRoundLinks!: MeetingRoundMemberLinks[];

  @OneToMany(() => MeetingRoundResponse, MeetingRoundResponse => MeetingRoundResponse.meetingRound)
  responses!: MeetingRoundResponse[];

  @OneToMany(() => MeetingRoundPrepItem, MeetingRoundPrepItem => MeetingRoundPrepItem.meetingRound)
  prepItems!: MeetingRoundPrepItem[];

}
