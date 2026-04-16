# 반복 모임 운영 서비스, Moimloop

## 0. overview
- [ERD](./entity_modeling.md)와 화면 문맥을 기준으로 V1 API 초안을 정의
- 설계 범위
  - Common 화면: 로그인, 회원가입, 모임 생성/수정, 멤버 링크 랜딩, 공통 진입 상태
  - V1 화면: 대시보드, 모임 목록, 모임 상세, 회차 생성, 회차 수정, 회차 상세, 회차 확정, 회차 종료, 다음 회차 시작, 멤버 응답
- 설계 기준
  - Base URL은 `/api/v1`
  - 인증은 `JWT Access Token + HttpOnly Refresh Token 쿠키`
  - Access Token은 `Authorization: Bearer {access_token}` 으로 전달
  - Refresh Token은 `refresh_token` 쿠키로만 전달
  - 멤버 응답은 공개 링크 토큰 API가 아니라 로그인 기반 딥링크 방식으로 처리
  - Access Token 만료 시간은 30분, Refresh Token 만료 시간은 14일
  - Refresh Token은 단일 세션 + RTR(Refresh Token Rotation) 기준으로 동작
  - 성공 응답은 `{"data": ...}` 형식
  - 인증/인가 실패 응답은 전략 문서 기준 평면 포맷 사용
  - 일반 비즈니스 오류 응답은 `{"error": {...}}` 형식 사용
  - 사용자는 일반 계정으로 회원가입/로그인하고, 모임 생성 시 해당 모임의 `OWNER`가 된다.

## 1. 공통 규칙

### 인증
- 로그인 사용자 API
  - `Authorization: Bearer {access_token}` 형식의 JWT를 사용한다.
- 토큰 재발급 API
  - `refresh_token` HttpOnly 쿠키를 사용한다.
  - 대상 엔드포인트는 `POST /auth/tokens` 이다.
- 로그아웃 API
  - JWT Bearer 인증이 필요하다.
  - 서버는 현재 세션의 Refresh Token을 무효화하고 쿠키를 삭제한다.

### 인가
- `POST /meetings`, `GET /me`, `POST /auth/logout` 은 로그인 사용자면 호출할 수 있다.
- 운영자 화면용 모임/회차 API는 해당 모임의 `OWNER`만 호출할 수 있다.
- 멤버 응답 API는 로그인 사용자 중 해당 회차의 활성 멤버만 호출할 수 있다.
- 사용자 식별은 항상 JWT의 `principal.userId` 기준으로 처리한다.
- 요청 body나 path의 `user_id`는 인가 기준으로 신뢰하지 않는다.

### 쿠키 규칙
- Refresh Token 쿠키 이름: `refresh_token`
- 속성: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api/v1/auth`, `Max-Age=1209600`

### 공통 성공 응답
```json
{
  "data": {}
}
```

### 인증/인가 실패 응답
```json
{
  "code": "TOKEN_EXPIRED",
  "message": "Access token expired",
  "status": 401,
  "timestamp": "2026-04-16T10:00:00.000Z"
}
```

### 일반 비즈니스 실패 응답
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값을 확인해 주세요."
  }
}
```

### 공통 에러 코드
| 코드 | HTTP Status | 설명 |
| --- | --- | --- |
| `AUTH_UNAUTHORIZED` | 401 | 인증 정보 없음 |
| `TOKEN_INVALID` | 401 | Access Token 형식 또는 서명 오류 |
| `TOKEN_EXPIRED` | 401 | Access Token 만료 |
| `REFRESH_TOKEN_MISSING` | 401 | Refresh Token 쿠키 없음 |
| `REFRESH_TOKEN_INVALID` | 401 | Refresh Token 불일치 또는 무효화 |
| `REFRESH_TOKEN_EXPIRED` | 401 | Refresh Token 만료 |
| `AUTH_FORBIDDEN` | 403 | 인증은 되었지만 권한 없음 |
| `MEETING_LEADER_ONLY` | 403 | 모임장 전용 API |
| `MEETING_MEMBER_ONLY` | 403 | 모임 멤버 전용 API |
| `USER_NOT_FOUND` | 404 | 사용자 없음 |
| `MEETING_NOT_FOUND` | 404 | 모임 없음 |
| `MEETING_ROUND_NOT_FOUND` | 404 | 회차 없음 |
| `VALIDATION_ERROR` | 400 | 입력값 오류 |
| `ROUND_CLOSED` | 409 | 이미 종료된 회차 |
| `ROUND_NOT_EDITABLE` | 409 | 수정 불가능한 회차 |
| `ROUND_CONFIRM_BLOCKED` | 409 | 확정 조건 미충족 |

## 2. 인증 API
### POST /auth/signup
- 설명: 일반 사용자 계정을 생성한다.
- 인증: 없음

#### request
```json
{
  "email": "minjun@loop.study",
  "password": "password",
  "password_confirm": "password",
  "display_name": "민준"
}
```

#### response
```json
{
  "data": {
    "user_id": 1,
    "email": "minjun@loop.study",
    "display_name": "민준"
  }
}
```

### POST /auth/login
- 설명: 로그인 후 Access Token을 응답 바디로 반환하고 Refresh Token 쿠키를 설정한다.
- 인증: 없음

#### request
```json
{
  "email": "minjun@loop.study",
  "password": "password"
}
```

#### response
```json
{
  "data": {
    "access_token": "jwt-access-token",
    "token_type": "Bearer",
    "expires_in_seconds": 1800,
    "user": {
      "user_id": 1,
      "email": "minjun@loop.study",
      "display_name": "민준",
      "profile_image_url": null
    }
  }
}
```

#### response cookie
```http
Set-Cookie: refresh_token=opaque-refresh-token; Max-Age=1209600; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax
```

### POST /auth/tokens
- 설명: Refresh Token 쿠키로 Access Token을 재발급하고 Refresh Token을 회전한다.
- 인증: 없음

#### request
```json
{}
```

#### response
```json
{
  "data": {
    "access_token": "new-jwt-access-token",
    "token_type": "Bearer",
    "expires_in_seconds": 1800
  }
}
```

#### response cookie
```http
Set-Cookie: refresh_token=new-opaque-refresh-token; Max-Age=1209600; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax
```

### POST /auth/logout
- 설명: 현재 세션을 로그아웃 처리하고 Refresh Token 쿠키를 삭제한다.
- 인증: JWT Bearer

#### request
```json
{}
```

#### response
```http
204 No Content
```

#### response cookie
```http
Set-Cookie: refresh_token=; Max-Age=0; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax
```

### GET /me
- 설명: 현재 로그인한 사용자 정보 조회
- 인증: JWT Bearer

#### response
```json
{
  "data": {
    "user_id": 1,
    "email": "minjun@loop.study",
    "display_name": "민준",
    "profile_image_url": null
  }
}
```

## 4. 대시보드 / 모임 API

### GET /dashboard
- 설명: V1 대시보드에 필요한 현재 회차 요약 조회
- 인증: JWT Bearer
- 인가: 모임 운영자

#### response
```json
{
  "data": {
    "current_round": {
      "meeting_id": 10,
      "meeting_name": "백엔드 스터디",
      "meeting_round_id": 101,
      "round_number": 13,
      "title": "13회차 NestJS 인증 흐름",
      "status": "PREPARING",
      "scheduled_at": "2026-04-18T10:30:00Z",
      "location_text": "서울역 스터디룸 3번 / 오프라인"
    },
    "summary": {
      "member_count": 5,
      "responded_count": 3,
      "no_response_count": 2,
      "unassigned_prep_item_count": 1
    },
    "no_response_members": [
      { "meeting_member_id": 1001, "display_name": "민준" },
      { "meeting_member_id": 1004, "display_name": "유나" }
    ],
    "unassigned_prep_items": [
      { "meeting_round_prep_item_id": 5002, "title": "실습 환경 체크" }
    ],
    "last_closed_round": {
      "meeting_round_id": 100,
      "title": "12회차 Node.js 에러 핸들링",
      "close_note_text": "실습 저장소 브랜치가 오래돼 초반 진입 시간이 길었다."
    }
  }
}
```

### GET /meetings
- 설명: 현재 로그인한 운영자의 모임 목록 조회
- 인증: JWT Bearer
- 인가: 모임 운영자

#### response
```json
{
  "data": {
    "meetings": [
      {
        "meeting_id": 10,
        "name": "백엔드 스터디",
        "cadence_label": "매주 수요일 19:30",
        "expected_member_count": 5,
        "member_count": 5,
        "current_round": {
          "meeting_round_id": 101,
          "round_number": 13,
          "title": "13회차 NestJS 인증 흐름",
          "status": "PREPARING",
          "scheduled_at": "2026-04-18T10:30:00Z"
        }
      }
    ]
  }
}
```

### POST /meetings
- 설명: 모임 생성
- 인증: JWT Bearer

#### request
```json
{
  "name": "백엔드 스터디",
  "description": "NestJS, 테스트, 실전 설계 주제를 매주 읽고 실습하는 고정 멤버 스터디다.",
  "cadence_label": "매주 수요일 19:30",
  "expected_member_count": 5,
  "owner_display_name": "민준"
}
```

#### response
```json
{
  "data": {
    "meeting_id": 10,
    "name": "백엔드 스터디",
    "description": "NestJS, 테스트, 실전 설계 주제를 매주 읽고 실습하는 고정 멤버 스터디다.",
    "cadence_label": "매주 수요일 19:30",
    "expected_member_count": 5
  }
}
```

### PATCH /meetings/{meetingId}
- 설명: 모임 수정
- 인증: JWT Bearer
- 인가: 해당 모임 `OWNER`

#### request
```json
{
  "name": "백엔드 스터디",
  "description": "설명을 수정한 값",
  "cadence_label": "격주 토요일 10:00",
  "expected_member_count": 6,
  "owner_display_name": "민준"
}
```

#### response
```json
{
  "data": {
    "meeting_id": 10,
    "name": "백엔드 스터디",
    "description": "설명을 수정한 값",
    "cadence_label": "격주 토요일 10:00",
    "expected_member_count": 6
  }
}
```

### GET /meetings/{meetingId}
- 설명: 모임 상세 조회
- 인증: JWT Bearer
- 인가: 해당 모임 `OWNER`

#### response
```json
{
  "data": {
    "meeting": {
      "meeting_id": 10,
      "name": "백엔드 스터디",
      "description": "NestJS, 테스트, 실전 설계를 매주 읽고 실습하는 고정 멤버 스터디",
      "cadence_label": "매주 수요일 19:30",
      "expected_member_count": 5
    },
    "members": [
      {
        "meeting_member_id": 1001,
        "user_id": 1,
        "display_name": "민준",
        "role_type": "OWNER",
        "membership_status": "ACTIVE"
      },
      {
        "meeting_member_id": 1002,
        "user_id": 2,
        "display_name": "서연",
        "role_type": "MEMBER",
        "membership_status": "ACTIVE"
      }
    ],
    "current_round": {
      "meeting_round_id": 101,
      "round_number": 13,
      "title": "13회차 NestJS 인증 흐름",
      "status": "PREPARING",
      "scheduled_at": "2026-04-18T10:30:00Z"
    },
    "last_closed_round": {
      "meeting_round_id": 100,
      "round_number": 12,
      "title": "12회차 Node.js 에러 핸들링",
      "close_note_text": "실습 저장소 브랜치가 오래돼 초반 진입 시간이 길었다."
    }
  }
}
```

## 5. 회차 API

### GET /meetings/{meetingId}/next
- 설명: 다음 회차 시작 화면에 필요한 직전 회차 메모와 다음 액션 조회
- 인증: JWT Bearer
- 인가: 해당 모임 `OWNER`

#### response
```json
{
  "data": {
    "meeting": {
      "meeting_id": 10,
      "name": "백엔드 스터디"
    },
    "last_closed_round": {
      "meeting_round_id": 100,
      "round_number": 12,
      "title": "12회차 Node.js 에러 핸들링",
      "close_note_text": "실습 저장소 브랜치가 오래돼 초반 15분이 지연됐다."
    },
    "next_actions": [
      {
        "meeting_round_next_action_id": 9001,
        "content": "민준: 예제 브랜치 업데이트",
        "sort_order": 1
      },
      {
        "meeting_round_next_action_id": 9002,
        "content": "서연: 회고 질문 2개 다음 회차에도 유지",
        "sort_order": 2
      }
    ]
  }
}
```

### POST /meetings/{meetingId}/rounds
- 설명: 회차 생성
- 인증: JWT Bearer
- 인가: 해당 모임 `OWNER`

#### request
```json
{
  "title": "13회차 NestJS 인증 흐름",
  "scheduled_at": "2026-04-18T10:30:00Z",
  "location_text": "서울역 스터디룸 3번 / 오프라인",
  "guide_note": "JWT 흐름 정리 후 가드와 전략 실습까지 진행한다.",
  "prep_items": [
    {
      "title": "발표 자료 준비",
      "description": "발표 흐름 15분 분량",
      "assignee_meeting_member_id": 1003,
      "sort_order": 1
    },
    {
      "title": "실습 환경 체크",
      "description": "시작 전 저장소 클론 및 패키지 설치 확인",
      "assignee_meeting_member_id": null,
      "sort_order": 2
    }
  ]
}
```

#### response
```json
{
  "data": {
    "meeting_round_id": 101,
    "meeting_id": 10,
    "round_number": 13,
    "status": "PREPARING",
    "member_entry": {
      "path": "/meeting-rounds/101/respond",
      "url": "https://app.moimloop.com/meeting-rounds/101/respond"
    }
  }
}
```

### GET /meeting-rounds/{roundId}
- 설명: 운영자용 회차 상세 조회
- 인증: JWT Bearer
- 인가: 해당 모임 `OWNER`

#### response
```json
{
  "data": {
    "meeting": {
      "meeting_id": 10,
      "name": "백엔드 스터디"
    },
    "round": {
      "meeting_round_id": 101,
      "round_number": 13,
      "title": "13회차 NestJS 인증 흐름",
      "scheduled_at": "2026-04-18T10:30:00Z",
      "location_text": "서울역 스터디룸 3번 / 오프라인",
      "guide_note": "JWT 흐름 정리 후 가드와 전략 실습까지 진행한다.",
      "status": "PREPARING",
      "close_note_text": null
    },
    "summary": {
      "member_count": 5,
      "attend_count": 3,
      "maybe_count": 0,
      "absent_count": 0,
      "no_response_count": 2,
      "unassigned_prep_item_count": 1
    },
    "members": [
      {
        "meeting_member_id": 1001,
        "display_name": "민준",
        "attendance_status": null,
        "comment_text": null
      },
      {
        "meeting_member_id": 1002,
        "display_name": "서연",
        "attendance_status": "ATTEND",
        "comment_text": "회고 질문 정리 맡을게요."
      }
    ],
    "prep_items": [
      {
        "meeting_round_prep_item_id": 5001,
        "title": "발표 자료 준비",
        "description": "발표 흐름 15분 분량",
        "sort_order": 1,
        "assignee": {
          "meeting_member_id": 1003,
          "display_name": "지훈"
        }
      },
      {
        "meeting_round_prep_item_id": 5002,
        "title": "실습 환경 체크",
        "description": "시작 전 저장소 클론 및 패키지 설치 확인",
        "sort_order": 2,
        "assignee": null
      }
    ],
    "next_actions": [
      {
        "meeting_round_next_action_id": 9001,
        "content": "민준: 예제 브랜치 업데이트",
        "sort_order": 1
      }
    ],
    "member_entry": {
      "path": "/meeting-rounds/101/respond",
      "url": "https://app.moimloop.com/meeting-rounds/101/respond"
    }
  }
}
```

### PATCH /meeting-rounds/{roundId}
- 설명: 회차 수정
- 인증: JWT Bearer
- 인가: 해당 모임 `OWNER`

#### request
```json
{
  "title": "13회차 NestJS 인증 흐름",
  "scheduled_at": "2026-04-18T10:30:00Z",
  "location_text": "서울역 스터디룸 3번 / 오프라인",
  "guide_note": "안내 메모 수정",
  "prep_items": [
    {
      "meeting_round_prep_item_id": 5001,
      "title": "발표 자료 준비",
      "description": "발표 흐름 15분 분량",
      "assignee_meeting_member_id": 1003,
      "sort_order": 1
    },
    {
      "meeting_round_prep_item_id": 5002,
      "title": "실습 환경 체크",
      "description": "시작 전 저장소 클론 및 패키지 설치 확인",
      "assignee_meeting_member_id": 1004,
      "sort_order": 2
    }
  ]
}
```

#### response
```json
{
  "data": {
    "meeting_round_id": 101,
    "status": "PREPARING"
  }
}
```

### POST /meeting-rounds/{roundId}/confirm
- 설명: 회차 확정
- 인증: JWT Bearer
- 인가: 해당 모임 `OWNER`

#### request
```json
{}
```

#### response
```json
{
  "data": {
    "meeting_round_id": 101,
    "status": "CONFIRMED",
    "confirmed_at": "2026-04-17T09:00:00Z"
  }
}
```

#### blocked error example
```json
{
  "error": {
    "code": "ROUND_CONFIRM_BLOCKED",
    "message": "미응답 멤버 또는 미배정 준비 항목이 남아 있습니다."
  }
}
```

### POST /meeting-rounds/{roundId}/close
- 설명: 회차 종료 및 종료 메모/다음 액션 저장
- 인증: JWT Bearer
- 인가: 해당 모임 `OWNER`

#### request
```json
{
  "close_note_text": "에러 핸들링 흐름은 좋았지만 실습 저장소 브랜치가 오래돼 초반 15분이 지연됐다.",
  "next_actions": [
    {
      "content": "민준: 예제 브랜치 업데이트",
      "sort_order": 1
    },
    {
      "content": "서연: 회고 질문 2개 다음 회차에도 유지",
      "sort_order": 2
    }
  ]
}
```

#### response
```json
{
  "data": {
    "meeting_round_id": 100,
    "status": "CLOSED",
    "closed_at": "2026-04-16T12:00:00Z"
  }
}
```

### POST /meeting-rounds/{roundId}/cancel
- 설명: 준비 중 회차 취소
- 인증: JWT Bearer
- 인가: 해당 모임 `OWNER`

#### request
```json
{}
```

#### response
```json
{
  "data": {
    "meeting_round_id": 101,
    "status": "CANCELLED",
    "cancelled_at": "2026-04-16T14:10:00Z"
  }
}
```

## 6. 멤버 딥링크 / 응답 API

### GET /meeting-rounds/{roundId}/my-response
- 설명: 로그인한 멤버의 회차 응답 화면 데이터를 조회한다.
- 인증: JWT Bearer
- 인가: 해당 회차의 활성 멤버

#### note
- 프론트 딥링크 예시는 `/meeting-rounds/{roundId}/respond` 이다.
- 비로그인 상태에서 딥링크 진입 시 프론트는 로그인 화면으로 이동한 뒤 원래 경로로 복귀한다.
- 로그인 완료 후 이 API를 호출해 실제 응답 데이터를 그린다.

#### response
```json
{
  "data": {
    "meeting": {
      "meeting_id": 10,
      "name": "백엔드 스터디"
    },
    "round": {
      "meeting_round_id": 101,
      "round_number": 13,
      "title": "13회차 NestJS 인증 흐름",
      "scheduled_at": "2026-04-18T10:30:00Z",
      "location_text": "서울역 스터디룸 3번 / 오프라인",
      "guide_note": "JWT 흐름 정리 후 가드와 전략 실습까지 진행한다.",
      "status": "PREPARING"
    },
    "member": {
      "meeting_member_id": 1004,
      "display_name": "유나"
    },
    "response": {
      "attendance_status": null,
      "comment_text": null
    },
    "prep_items": [
      {
        "meeting_round_prep_item_id": 5001,
        "title": "실습 환경 체크",
        "description": "시작 전 저장소 클론 및 패키지 설치 확인",
        "sort_order": 1,
        "assignee": null
      },
      {
        "meeting_round_prep_item_id": 5002,
        "title": "발표 자료 보기",
        "description": "지훈이 준비 중. 참고만 가능",
        "sort_order": 2,
        "assignee": {
          "meeting_member_id": 1003,
          "display_name": "지훈"
        }
      }
    ]
  }
}
```

### PUT /meeting-rounds/{roundId}/my-response
- 설명: 로그인한 멤버의 응답을 저장 또는 수정한다.
- 인증: JWT Bearer
- 인가: 해당 회차의 활성 멤버

#### request
```json
{
  "attendance_status": "ATTEND",
  "comment_text": "10분 정도 늦을 수 있어요. 실습 환경 체크는 제가 맡을 수 있습니다.",
  "assigned_prep_item_ids": [5001]
}
```

#### response
```json
{
  "data": {
    "meeting_round_id": 101,
    "meeting_member_id": 1004,
    "attendance_status": "ATTEND",
    "comment_text": "10분 정도 늦을 수 있어요. 실습 환경 체크는 제가 맡을 수 있습니다.",
    "prep_items": [
      {
        "meeting_round_prep_item_id": 5001,
        "assignee": {
          "meeting_member_id": 1004,
          "display_name": "유나"
        }
      }
    ]
  }
}
```