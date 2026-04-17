import { Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Meeting } from "../../meetings/entities/meeting.entity";
import { MeetingMember } from "../../meetings/entities/meeting-member.entity";

@Entity('users')
export class User {

  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id!: string;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: false,
  })
  email!: string;

  @Column({
    type: 'varchar',
    length: 65,
    nullable: false,
  })
  password!: string;

  @Column({
    type: 'varchar',
    length: 60,
    unique: true,
    nullable: false,
  })
  nickname!: string;

  @Column({
    name: 'profile_image_url',
    type: 'text',
  })
  profileImageUrl!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamptz',
  })
  deletedAt!: Date | null;

  @OneToMany(() => Meeting, meeting => meeting.owner)
  meetings!: Meeting[] | null;

  @OneToMany(() => MeetingMember, MeetingMembers => MeetingMembers.user)
  meetingMembers!: MeetingMember[] | null;
  
}
