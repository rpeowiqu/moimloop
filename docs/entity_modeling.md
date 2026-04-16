# 반복 모임 운영 서비스, Moimloop

## 0. overview

이 문서는 반복 모임 운영 서비스 **Moimloop**의 엔티티 설계 방향을 정리하기 위한 문서이다.  
Moimloop는 동일한 멤버가 여러 회차에 걸쳐 반복적으로 만나는 모임을 운영하는 과정에서 발생하는 일정 확인, 참석 수집, 준비 항목 관리, 회차 종료 후 후속 액션 기록 등의 흐름을 한 곳에서 관리하는 서비스를 목표로 한다.

본 문서에서는 이러한 사용자 흐름을 기준으로 서비스의 핵심 데이터 대상을 식별하고, 각 엔티티의 역할과 책임, 엔티티 간 관계, 회차 중심 데이터의 구조를 정리한다.  
특히 Moimloop의 핵심 도메인인 **모임**, **회차**, **멤버 응답**, **준비 항목**, **회차 종료 기록과 다음 액션**이 어떻게 연결되는지를 명확히 정의하는 데 목적이 있다.

### 설계 기준
- PK는 기본적으로 `BIGINT`로 통일
  - 단일 기준으로 맞춰 FK 타입 정합성과 마이그레이션 일관성을 유지하기 위함
- 시각 컬럼은 기본적으로 `TIMESTAMP` 사용
  - 회차 일정, 링크 만료, 알림 발송 등 절대 시점 비교가 필요한 값이 많기 때문
  - 날짜만 필요하면 `DATE`, 정수 범위가 작은 값들은 `SMALLINT` 사용

## 1. 사용자
### users
| **설명** | 로그인 가능한 전역 사용자 계정의 기본 정보 |
| --- | --- |
| **조회 규칙** | `id` + `deleted_at IS NULL` 단건 조회를 기본으로 함 |
| **인덱스** | `PRIMARY KEY (id)` |
| **유니크** | email |

| 컬럼명 | 타입 | 한국말 컬럼명 | 제약 조건 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT | 사용자 ID | PK ||
| email | VARCHAR(255) | 이메일 | UNIQUE, NOT NULL ||
| password | VARCHAR(65) | 비밀번호 | NOT NULL | bcrypt 해시 길이보다 넉넉하게 65 |
| nickname | VARCHAR(60) | 닉네임 | UNIQUE, NOT NULL ||
| profile_image_url | TEXT | 프로필 이미지 url | NULL ||
| created_at | TIMESTAMP | 가입 일시 | NOT NULL, DEFAULT now() ||
| deleted_at | TIMESTAMP | 탈퇴 일시 | NULL ||

## 2. 모임
### meetings
| **설명** | 반복 모임의 기본 정보와 운영 단위 설정을 저장하는 테이블 |
| --- | --- |
| **조회 규칙** | 운영자 홈/모임 목록에서는 `owner_user_id` 기준으로 조회하고, 기본 목록은 `archived_at IS NULL`인 활성 모임을 최신 수정 순으로 보여 준다. |
| **인덱스** | `PRIMARY KEY (meeting_id)`<br>`INDEX idx_meetings_owner_active (owner_user_id, created_at, updated_at DESC)` |
| **유니크** | 없음 |

| 컬럼명 | 타입 | 한국말 컬럼명 | 제약 조건 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT | 모임 ID | PK ||
| owner_user_id | BIGINT | 운영자 ID | NOT NULL, FK(`users.id`) ||
| name | VARCHAR(200) | 모임명 | NOT NULL ||
| description | TEXT | 모임 설명 | NULL ||
| one_liner | VARCHAR(100) | 한 줄 소개 | NULL ||
| created_at | TIMESTAMP | 생성 시각 | NOT NULL, DEFAULT now() ||
| updated_at | TIMESTAMP | 수정 시각 | NOT NULL, DEFAULT now() ||

- 모임은 복구하는 경우를 신경쓰지 않고 hard delete를 한다.

### meeting_members
| **설명** | 모임별 멤버 roster를 저장하는 테이블. 계정 기반 운영자와 링크 기반 일반 멤버를 함께 담는다. |
| --- | --- |
| **조회 규칙** | 모임 상세에서는 `meeting_id + status='ACTIVE'`로 현재 참여자를 조회한다. 회차 응답 현황도 이 참여자를 기준으로 본다. |
| **인덱스** | `PRIMARY KEY (user_id)`<br>`INDEX idx_meeting_members_meeting_active (meeting_id, status, user_id)`<br>`INDEX idx_meeting_members_user_active (user_id, status) WHERE user_id IS NOT NULL` |
| **유니크** | `UNIQUE (meeting_id, user_id) WHERE user_id IS NOT NULL` |

| 컬럼명 | 타입 | 한국말 컬럼명 | 제약 조건 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT | 모임 멤버 ID | PK ||
| meeting_id | BIGINT | 모임 ID | NOT NULL, FK(`meetings.id`) ||
| user_id | BIGINT | 유저 ID | NULL, FK(`users.id`) | 미가입자도 사용 가능 |
| name | VARCHAR(200) | 이름 | NOT NULL | 모임 내 표시 이름 |
| role | enum(`OWNER`, `CO_HOST`, `MEMBER`) | 역할 | NOT NULL, DEFAULT `MEMBER` ||
| status | enum(`ACTIVE`, `LEFT`, `REMOVED`) | 참여 상태 | NOT NULL, DEFAULT `ACTIVE` ||
| joined_at | TIMESTAMP | 참여 일시 | NOT NULL, DEFAULT now() ||
| left_at | TIMESTAMP | 이탈 일시 | NULL | 탈퇴/제외 시각 |

## 3. 회차
### meeting_rounds
| **설명** | 모임의 각 회차 일정과 상태를 관리하는 핵심 테이블 |
| --- | --- |
| **조회 규칙** | 현재 회차 조회는 `meeting_id + status IN ('PREPARING','CONFIRMED')`가 기본이다. 종료 히스토리는 `meeting_id + status='CLOSED'`를 종료일 기준으로 읽는다. |
| **인덱스** | `PRIMARY KEY (id)`<br>`UNIQUE (meeting_id, round_number)`<br>`INDEX idx_meeting_rounds_current (meeting_id, status, scheduled_at DESC)`<br>`INDEX idx_meeting_rounds_history (meeting_id, status DESC)` |
| **유니크** | `U| 컬럼명 | 타입 | 한국말 컬럼명 | 제약 조건 | 설명 |

| 컬럼명 | 타입 | 한국말 컬럼명 | 제약 조건 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT | 회차 ID | PK ||
| meeting_id | BIGINT | 모임 ID | NOT NULL, FK(`meetings.id`) ||
| round_number | SMALLINT | 회차 번호 | NOT NULL, DEFAULT 1 ||
| title | VARCHAR(120) | 회차 제목 | NOT NULL | 예: 2회차 알고리즘 스터디 |
| scheduled_at | TIMESTAMP | 예정 일시 | NOT NULL ||
| location | VARCHAR(300) | 회의 장소 | NOT NULL ||
| description | TEXT | 설명 | NULL ||
| status | enum(`SCHEDULED`, `CONFIRMED`, `CLOSED`, `CANCELED`) | 상태 | NOT NULL, DEFAULT `SCHEDULED` ||
| created_at | TIMESTAMP | 생성 일시 | NOT NULL, DEFAULT now() ||
| updated_at | TIMESTAMP | 수정 일시 | NOT NULL, DEFAULT now() ||

## 4. 응답 / 참석 / 준비
### meeting_round_member_links
| **설명** | 회차별 멤버 응답 링크를 저장하는 테이블 |
| --- | --- |
| **조회 규칙** | 멤버 링크 진입 시 `token`으로 단건 조회한다. 운영자는 `meeting_round_id` 기준으로 어떤 멤버에게 링크가 연결돼 있는지 확인한다. |
| **인덱스** | `PRIMARY KEY (id)`<br>`UNIQUE (token)`<br>`UNIQUE (meeting_round_id, meeting_member_id)` |
| **유니크** | `UNIQUE (token)`<br>`UNIQUE (meeting_round_id, meeting_member_id)` |

| 컬럼명 | 타입 | 한국말 컬럼명 | 제약 조건 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT | 회차 멤버 링크 ID | PK ||
| meeting_round_id | BIGINT | 회차 ID | NOT NULL, FK(`meeting_rounds.id`) ||
| meeting_member_id | BIGINT | 모임 멤버 ID | NOT NULL, FK(`meeting_members.id`) ||
| token | TEXT | 링크 토큰 | NOT NULL ||
| created_at | TIMESTAMP | 생성 시각 | NOT NULL, DEFAULT now() ||
| expires_at | TIMESTAMP | 만료 시각 | NOT NULL ||

### meeting_round_responses
| **설명** | 회차별 멤버 응답을 저장하는 테이블 |
| --- | --- |
| **조회 규칙** | 운영자 화면에서는 `meeting_members`를 기준으로 left join 해서 미응답자를 함께 본다. 멤버 응답 저장은 `meeting_round_id + meeting_member_id` 기준 upsert가 기본이다. |
| **인덱스** | `PRIMARY KEY (id)`<br>`UNIQUE (meeting_round_id, meeting_member_id)`<br>`INDEX idx_round_responses_status (meeting_round_id, response)` |
| **유니크** | `UNIQUE (meeting_round_id, meeting_member_id)` |

| 컬럼명 | 타입 | 한국말 컬럼명 | 제약 조건 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT | 회차 응답 ID | PK ||
| meeting_round_id | BIGINT | 회차 ID | NOT NULL, FK(`meeting_rounds.id`) ||
| meeting_member_id | BIGINT | 모임 멤버 ID | NOT NULL, FK(`meeting_members.id`) ||
| response | enum(`ATTEND`, `ABSENT`) | 응답 상태 | NOT NULL, DEFAULT `ATTEND` ||
| comment | VARCHAR(300) | 코멘트 | NULL ||
| created_at | TIMESTAMP | 생성 일시 | NOT NULL, DEFAULT now() ||
| updated_at | TIMESTAMP | 수정 일시 | NOT NULL, DEFAULT now() ||

### meeting_round_prep_items
| **설명** | 회차별 준비물/역할 분담을 하나의 목록으로 관리하는 테이블 |
| --- | --- |
| **조회 규칙** | 회차 상세와 멤버 응답 화면에서는 `meeting_round_id` 기준 전체 목록을 `sort_order` 순으로 읽는다. 미배정 항목은 `assigneeid IS NULL`로 바로 식별한다. |
| **인덱스** | `PRIMARY KEY (id)`<br>`INDEX idx_round_prep_items_round (meeting_round_id, sort_order)`<br>`INDEX idx_round_prep_items_assignee (meeting_round_id, assignee_id)` |
| **유니크** | 없음 |

| 컬럼명 | 타입 | 한국말 컬럼명 | 제약 조건 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT | 회차 준비 ID | PK ||
| meeting_round_id | BIGINT | 회차 ID | NOT NULL, FK(`meeting_rounds.id`) ||
| title | VARCHAR(120) | 항목명 | NOT NULL ||
| description | TEXT | 설명 | NULL ||
| assignee_id | BIGINT | 담당 멤버 ID | NULL, FK(`meeting_members.id`) ||
| sort_order | SMALLINT | 정렬 순서 | NOT NULL ||
| created_at | TIMESTAMP | 생성 일시 | NOT NULL, DEFAULT now() ||
| updated_at | TIMESTAMP | 수정 일시 | NOT NULL, DEFAULT now() ||
