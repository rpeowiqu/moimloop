import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Meeting } from "./meeting.entity";
import { User } from "../../users/entities/user.entity";
import { MeetingMemberStatus, Role } from "@repo/shared";

@Entity('meeting_members')
export class MeetingMembers {

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

}