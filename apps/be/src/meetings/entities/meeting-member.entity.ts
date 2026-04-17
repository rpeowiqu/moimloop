import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Meeting } from "./meeting.entity";
import { User } from "../../users/entities/user.entity";
import { MeetingMemberStatus, Role } from "@repo/shared";
import { MeetingRoundMemberLinks } from "../../rounds/entities/meeting-round-member-links.entity";
import { MeetingRoundResponse } from "../../rounds/entities/meeting-round-response.entity";
import { MeetingRoundPrepItem } from "../../rounds/entities/meeting-round-prep-item.entity";

@Entity('meeting_members')
export class MeetingMember {

  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id!: string;

  @ManyToOne(() => Meeting, meeting => meeting.id, {
    nullable: false,
  })
  @JoinColumn({ name: 'meeting_id' })
  meeting!: Meeting;

  @ManyToOne(() => User, user => user.id)
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: false,
  })
  name!: string;

  @Column({
    type: 'enum',
    enum: Role,
    nullable: false,
    default: Role.MEMBER,
  })
  role!: Role;

  @Column({
    type: 'enum',
    enum: MeetingMemberStatus,
    nullable: false,
    default: MeetingMemberStatus.ACTIVE,
  })
  status!: MeetingMemberStatus;

  @CreateDateColumn({
    name: 'joined_at',
    type: 'timestamptz',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  joinedAt!: Date;

  @Column({
    name: 'left_at',
    type: 'timestamptz',
  })
  leftAt!: Date | null;
  
  @OneToOne(() => MeetingRoundMemberLinks, MeetingRoundMemberLinks => MeetingRoundMemberLinks.meetingMember)
  link!: MeetingRoundMemberLinks | null;

  @OneToOne(() => MeetingRoundResponse, MeetingRoundResponse => MeetingRoundResponse.meetingMember)
  response!: MeetingRoundResponse | null;

  @OneToMany(() => MeetingRoundPrepItem, MeetingRoundPrepItem => MeetingRoundPrepItem.meetingMember)
  prepItems!: MeetingRoundPrepItem[] | null;

}