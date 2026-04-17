import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { MeetingMembers } from "./meeting-members.entity";
import { MeetingRound } from "../../rounds/entities/meeting-round.entity";

@Entity('meetings')
export class Meeting {

  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id!: string;

  @ManyToOne(() => User, user => user.id, {
    nullable: false,
  })
  @JoinColumn({ name: 'owner_id'})
  owner!: User;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: false,
  })
  name!: string;

  @Column({
    type: 'text',
  })
  description!: string | null;

  @Column({
    name: 'one_liner',
    type: 'varchar',
    length: 100,
  })
  oneLiner!: string | null;

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

  @OneToMany(() => MeetingMembers, MeetingMembers => MeetingMembers.meeting)
  meetingMembers!: MeetingMembers[] | null;

  @OneToMany(() => MeetingRound, MeetingRound => MeetingRound.meeting)
  rounds!: MeetingRound[] | null;

}
