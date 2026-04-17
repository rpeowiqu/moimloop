import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { MeetingRound } from "./meeting-round.entity";
import { MeetingMember } from "../../meetings/entities/meeting-member.entity";

@Entity('meeting_round_member_links')
export class MeetingRoundMemberLinks {

  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id!: string;

  @ManyToOne(() => MeetingRound, MeetingRound => MeetingRound.meetingRoundLinks, {
    nullable: false,
  })
  @JoinColumn({ name: 'meeting_round_id' })
  meetingRound!: MeetingRound;

  @OneToOne(() => MeetingMember, MeetingMember => MeetingMember.link, {
    nullable: false,
  })
  @JoinColumn({ name: 'meeting_member_id' })
  meetingMember!: MeetingMember;

  @Column({
    type: 'text',
    nullable: false,
  })
  token!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @Column({
    name: 'expires_at',
    type: 'timestamptz',
    nullable: false,
  })
  expiresAt!: Date;

}