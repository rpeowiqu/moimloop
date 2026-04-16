# 반복 모임 운영 서비스, Moimloop

## 0. overview
이 문서는 Moimloop의 **인증/인가 전략**을 정의한 문서이다. 
Moimloop는 동일한 멤버가 반복적으로 만나는 소규모 모임을 운영하는 서비스이므로, 인증/인가는 다음 목표를 동시에 만족해야 한다.

- 로그인 유지가 안정적이어야 한다.
- 모임장/모임원/본인 리소스에 대한 권한 검증이 일관되어야 한다.
- 인증 로직이 컨트롤러/서비스에 흩어지지 않아야 한다.
- 회차 링크 진입 같은 사용자 흐름에서도 보안과 UX가 동시에 유지되어야 한다.

## 1. 최종 결정

Moimloop의 인증/인가는 아래 원칙으로 고정한다.

1. **인증 방식은 JWT Access Token + HttpOnly Refresh Token 쿠키**를 사용한다.
2. **Access Token은 짧게, Refresh Token은 길게** 운영한다.
3. **Refresh Token은 서버 저장소에서 관리**하며, **RTR(Refresh Token Rotation)** 을 적용한다.
4. **세션 정책은 단일 세션**으로 고정한다. 새 로그인 또는 재발급 시 기존 Refresh Token은 즉시 무효화된다.
5. **프론트엔드는 Access Token을 메모리에만 저장**한다. `localStorage`, `sessionStorage`에는 저장하지 않는다.
6. **인가 모델은 전역 Role 기반이 아니라 리소스 기반을 중심**으로 한다.
7. **모임장/모임원 여부 검증은 NestJS Guard + Authorization Service**로 집중시킨다.
8. **V1에서는 인증 채널을 HTTP REST로 한정**한다. WebSocket/SSE 인증은 도입 시 별도 문서에서 확정한다.
9. **회차 링크 진입은 공개 링크가 아니라 인증이 필요한 딥링크 방식**으로 처리한다. 비로그인 상태에서 링크 진입 시 로그인 후 원래 경로로 복귀한다.

## 2. 인증 모델

## 2.1 Access Token

- 형식: JWT
- 서명 알고리즘: `HS256`
- 전달 방식: `Authorization: Bearer <access_token>`
- 만료 시간: **30분**
- 사용 목적: 인증이 필요한 모든 일반 API 호출
- 클레임 정책:
  - `sub`: 사용자 ID
  - `sid`: 세션 ID
  - `typ`: `access`
  - `iat`, `exp`

### 선택 근거

- Moimloop는 현재 단일 백엔드 기준의 MVP 구조이므로, RS256/JWK 기반 키 관리보다 **HS256 기반 단순 운영**이 더 적합하다.
- Access Token은 서버 저장소 조회 없이 검증 가능한 구조로 유지하여, 대부분의 요청에서 인증 비용을 최소화한다.
- 만료 시간을 30분으로 두어, 탈취 시 피해 범위를 제한하면서도 사용 중 자주 끊기지 않도록 균형을 맞춘다.

## 2.2 Refresh Token

- 형식: **Opaque Random Token**
- 전달 방식: `refresh_token` **HttpOnly 쿠키**
- 만료 시간: **14일**
- 사용 목적:
  - `POST /api/v1/auth/tokens`
  - `POST /api/v1/auth/logout`
- 저장 방식:
  - 서버 DB에는 **원문이 아닌 해시값만 저장**
  - 쿠키에는 원문 토큰 저장
- 회전 정책:
  - 로그인 성공 시 발급
  - 재발급 성공 시 즉시 교체
  - 기존 Refresh Token은 즉시 무효화

### 선택 근거

- Access Token은 JWT로 충분하지만, Refresh Token까지 JWT로 둘 필요는 없다.
- Refresh Token은 서버가 강하게 통제해야 하므로, **서버 저장 + 해시 비교 + 회전** 구조가 더 단순하고 안전하다.
- 주 사용자가 주 단위로 서비스를 이용할 가능성이 높으므로, 7일보다 **14일**이 서비스 특성에 더 적합하다.
- 프론트 JavaScript에서 접근할 수 없도록 **HttpOnly 쿠키**로 고정하여 XSS 피해 범위를 줄인다.

## 2.3 프론트엔드 토큰 저장 정책

프론트엔드의 토큰 저장 정책은 다음과 같이 고정한다.

- Access Token: **메모리 저장**
- Refresh Token: **HttpOnly 쿠키**
- 금지 항목:
  - `localStorage` 저장 금지
  - `sessionStorage` 저장 금지
  - Refresh Token 원문 접근 금지

### 앱 부트스트랩 정책

- 앱 최초 로딩 시 메모리에 Access Token이 없고, Refresh Token 쿠키가 존재할 수 있으므로
  - 프론트는 앱 시작 시 **1회 `/api/v1/auth/tokens` 호출**로 Access Token을 복구한다.
- 이후 인증이 필요한 API에서 401 `TOKEN_EXPIRED`를 받으면
  - 프론트는 **단일 재발급 요청(single flight)** 으로 `/api/v1/auth/tokens`를 호출한다.
  - 재발급 성공 시 원 요청을 1회 재시도한다.
  - 재발급 실패 시 로그인 화면으로 이동한다.

### 선택 근거

- Access Token을 브라우저 저장소에 두지 않으면 XSS 시 장기 토큰 탈취 위험을 줄일 수 있다.
- Refresh Token은 쿠키로만 운용하고, Access Token은 메모리에서만 유지하면 인증 UX와 보안 사이의 균형이 가장 좋다.

## 2.4 Refresh Token 저장소

Refresh Token 저장소는 우선 인메모리 저장소로 관리한다.

### 선택 근거

- 현재 고가용성이나 멀티 인스턴스 기반 서버 구조를 고려하고 있지 않기 때문에 굳이 Redis같은 외부 토큰스토어 형식을 고려하지 않았다.
- DB에 저장할 경우 요청마다 1번의 Disk I/O가 발생하기에 응답속도 측면에서 불리하므로 인메모리로 관리하기로 한다.

## 2.5 토큰 재발급(RTR) 정책

재발급 엔드포인트는 다음과 같이 동작한다.

- 엔드포인트: `POST /api/v1/auth/tokens`
- 입력: `refresh_token` 쿠키
- 출력:
  - 응답 바디: 새 Access Token
  - 응답 쿠키: 새 Refresh Token

### 재발급 처리 원칙

1. 쿠키에서 Refresh Token을 읽는다.
2. 토큰 원문을 해시하여 저장된 토큰과 비교한다.
3. 만료/무효화/불일치 여부를 검증한다.
4. 유효하면 기존 토큰스토어의 토큰을 새 값으로 교체
5. 새 access token과 refresh token을 반환한다.

## 2.6 로그인 / 로그아웃 정책

## 로그인

- 로그인은 OAuth 완료 후 서버가 토큰을 발급하는 방식으로 처리한다.
- 로그인 성공 시:
  - Access Token을 응답 바디로 반환
  - Refresh Token을 HttpOnly 쿠키로 설정
  - 기존 Refresh Token 세션이 있으면 즉시 교체

## 로그아웃

- 엔드포인트: `POST /api/v1/auth/logout`
- 인증 필요: **예**
- 처리:
  - 현재 사용자 기준 Refresh Token 세션 revoke
  - `refresh_token` 쿠키 삭제
  - 응답은 `204 No Content`

## 3. 인가 모델

## 3.1 전역 Role 정책

Moimloop의 전역 Role은 MVP에서 **`USER` 하나만 사용**한다.

- 전역 관리자(`ADMIN`)는 두지 않는다.
- “모임장”, “모임원”은 전역 Role이 아니라 **리소스 관계로 판단**한다.

### 선택 근거

- Moimloop의 핵심 권한은 “누가 어떤 모임의 운영자인가”, “누가 어떤 모임의 멤버인가”에 있다.
- 따라서 권한 모델의 중심은 글로벌 Role이 아니라 **리소스 기반 인가**다.

## 3.2 리소스 기반 권한 정책

### 모임 관련 권한

- **모임장만 가능**
  - 모임 수정
  - 회차 생성
  - 회차 확정
  - 회차 종료
  - 다음 액션 기록/수정
- **모임원만 가능**
  - 회차 상세 조회
  - 참석 여부 제출/수정
  - 준비 항목 담당 표시
- **본인만 가능**
  - 내 프로필 조회/수정
  - 내 세션 로그아웃
  - 내 계정 탈퇴

### 권한 판정 기준

- 모임장 여부: `meetings.leader_user_id = current_user_id`
- 모임원 여부: `meeting_members`에 활성 멤버 상태로 존재
- 본인 여부: `principal.user_id = resource_owner_id`

## 3.3 권한 검사 표준화

권한 검사는 컨트롤러와 서비스에 흩어놓지 않고, **NestJS Guard + Authorization Service**로 통합한다.

### 표준 Authorization Service

- `assertMeetingLeader(userId, meetingId)`
- `assertMeetingMember(userId, meetingId)`
- `assertOwner(userId, ownerUserId)`

### 표준 Guard

- `JwtAccessGuard`
- `MeetingLeaderGuard`
- `MeetingMemberGuard`

### 구현 원칙

- Guard는 요청의 `principal`과 route param을 사용해 권한을 검증한다.
- 실제 조회 로직은 Guard 내부가 아니라 Authorization Service에서 수행한다.
- Authorization Service는 항상 `deleted_at IS NULL`, 멤버 활성 상태 등 도메인 조건을 함께 검증한다.

### 선택 근거

- 권한 검사가 서비스/컨트롤러에 흩어지면 회차, 참석, 액션, 멤버십 도메인에서 중복과 누락이 발생한다.
- Moimloop는 리소스 기반 인가가 핵심이므로, 권한 검사를 별도 계층으로 고정한다.

## 3.4 403 / 404 정책

권한 및 리소스 예외는 아래 규칙으로 고정한다.

- **리소스 없음**: `404 Not Found`
- **권한 없음**: `403 Forbidden`

### 적용 예시

- 존재하지 않는 모임 조회: `404`
- 존재하는 모임이지만 모임장이 아닌 사용자가 회차 확정 시도: `403`
- 존재하지 않는 회차 종료 요청: `404`
- 존재하는 회차지만 모임원이 아닌 사용자의 접근: `403`

### 선택 근거

- MVP에서는 디버깅과 운영 가시성을 우선한다.
- 민감 리소스 은닉을 위해 404로 통일하는 정책은 도입하지 않는다.
- 추후 보안 요구가 강해지는 특정 리소스가 생기면 별도 문서에서 재검토한다.

## 4. NestJS 구현 표준

## 4.1 요청 처리 흐름

Moimloop의 인증/인가 요청 처리는 아래 흐름으로 고정한다.

1. `Cors` 설정 적용
2. `cookie-parser`로 Refresh Token 쿠키 파싱
3. `JwtAccessGuard`에서 Access Token 검증
4. 인증 성공 시 `request.user`에 `principal` 주입
5. 리소스 권한이 필요한 경우 `MeetingLeaderGuard` 또는 `MeetingMemberGuard` 실행
6. 컨트롤러 진입
7. 서비스 로직 수행
8. `ExceptionFilter` 또는 글로벌 예외 필터에서 표준 에러 응답 반환

## 4.2 Principal 규격

Access Token 검증 후 NestJS 요청 객체에는 아래 형태의 principal을 주입한다.

```ts
type Principal = {
  userId: number;
  sessionId: string;
  role: 'USER';
};
```

### 규칙

- 컨트롤러는 사용자 식별을 위해 path/body의 userId를 신뢰하지 않는다.
- 인증이 필요한 API는 항상 `request.user.userId`를 기준으로 동작한다.

## 4.3 Public Endpoint 정책

### `@Public()` 적용 엔드포인트

- `GET /health`
- OAuth 로그인 시작/콜백 엔드포인트
- `POST /api/v1/auth/tokens`

### 인증 필요 엔드포인트

- `/api/v1/users/me/**`
- `POST /api/v1/auth/logout`
- `/api/v1/meetings/**`
- `/api/v1/meeting-rounds/**`
- `/api/v1/meeting-members/**`
- `/api/v1/actions/**`

### 추가 정책

- 회차 공유 링크는 공개 API가 아니다.
- 회차 링크는 프론트 딥링크이며, 비로그인 사용자가 접근하면 로그인 후 원래 페이지로 복귀한다.

## 5. 쿠키 / CORS / CSRF 정책

## 5.1 Refresh Token 쿠키 속성

Refresh Token 쿠키는 아래 속성으로 고정한다.

- 이름: `refresh_token`
- `HttpOnly`
- `Secure`
- `SameSite=Lax`
- `Path=/api/v1/auth`
- `Max-Age=1209600` (14일)

### 로그아웃 시 쿠키 삭제

```http
Set-Cookie: refresh_token=; Max-Age=0; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax
```

### 선택 근거

- 쿠키 경로를 `/api/v1/auth`로 제한하여 불필요한 API 요청에 자동 전송되지 않도록 한다.
- Moimloop는 프론트와 API를 **같은 사이트(app/api 동일 eTLD+1)** 로 배포하는 것을 전제로 한다.
  - 예: `app.moimloop.com`, `api.moimloop.com`

## 5.2 CORS 정책

CORS는 아래 규칙으로 고정한다.

- 허용 Origin: 운영 프론트 도메인만 허용
- `credentials: true`
- 허용 메서드: `GET`, `POST`, `PATCH`, `DELETE`
- 허용 헤더:
  - `Authorization`
  - `Content-Type`

### 규칙

- 와일드카드 Origin(`*`)은 사용하지 않는다.
- 개발/스테이징/운영 Origin은 환경 변수로 분리 관리한다.

## 5.3 CSRF 정책

### 기본 원칙

- Authorization 헤더 기반 API는 CSRF 영향이 낮다.
- Refresh Token 쿠키를 사용하는 엔드포인트는 CSRF 관점에서 별도 보호가 필요하다.

### V1에서 적용하는 보호책

- `SameSite=Lax`
- 허용 Origin 제한
- `/api/v1/auth/tokens`, `/api/v1/auth/logout` 요청에 대해 **Origin 헤더 검증**

### V1에서 적용하지 않는 항목

- 별도 CSRF 토큰(Double Submit)은 도입하지 않는다.

### 선택 근거

- Moimloop V1은 same-site 도메인 배포를 전제로 하며, Refresh Token 쿠키가 사용되는 엔드포인트 수도 제한적이다.
- 따라서 V1에서는 `SameSite + Origin 검증`을 기본 방어책으로 고정한다.

## 6. 예외 처리 표준

## 6.1 401 인증 실패

다음 상황은 `401 Unauthorized`로 처리한다.

- Access Token 없음
- Access Token 형식 오류
- Access Token 만료
- Access Token 서명 오류
- Refresh Token 없음
- Refresh Token 만료
- Refresh Token 불일치 또는 무효화
- RTR 충돌

### 표준 코드

- `AUTH_UNAUTHORIZED`
- `TOKEN_INVALID`
- `TOKEN_EXPIRED`
- `REFRESH_TOKEN_MISSING`
- `REFRESH_TOKEN_INVALID`
- `REFRESH_TOKEN_EXPIRED`
- `TOKEN_REFRESH_CONFLICT`

## 6.2 403 인가 실패

다음 상황은 `403 Forbidden`으로 처리한다.

- 모임장이 아닌 사용자의 운영자 전용 API 접근
- 모임원이 아닌 사용자의 회차/응답 API 접근
- 본인 리소스가 아닌 사용자 정보 수정 시도

### 표준 코드

- `AUTH_FORBIDDEN`
- `MEETING_LEADER_ONLY`
- `MEETING_MEMBER_ONLY`
- `RESOURCE_OWNER_ONLY`

## 6.3 404 리소스 없음

리소스가 존재하지 않으면 `404 Not Found`로 처리한다.

### 표준 코드

- `USER_NOT_FOUND`
- `MEETING_NOT_FOUND`
- `MEETING_ROUND_NOT_FOUND`

## 6.4 응답 포맷

인증/인가 에러 응답은 아래 구조로 통일한다.

```json
{
  "code": "TOKEN_EXPIRED",
  "message": "Access token expired",
  "status": 401,
  "timestamp": "2026-04-16T10:00:00.000"
}
```

## 7. 회차 링크 진입 정책

Moimloop의 핵심 사용자 흐름 중 하나는 “멤버가 링크로 회차에 진입한다”는 점이다.  
V1에서는 이 흐름을 **공개 토큰 링크 방식이 아니라 인증 기반 딥링크 방식**으로 처리한다.

### 규칙

- 회차 링크는 회차 식별 경로를 가진 프론트 URL이다.
- 링크 자체에 인증 정보는 포함하지 않는다.
- 비로그인 사용자가 링크에 진입하면
  - 로그인 화면으로 이동
  - 로그인 성공 후 원래 회차 경로로 복귀
- 로그인 후에는 `MeetingMemberGuard`로 회차 접근 권한을 검증한다.

### 선택 근거

- V1에서는 링크만 가진 누구나 응답할 수 있는 공개 접근보다, 멤버 식별이 가능한 인증형 접근이 더 적합하다.
- 추후 외부 초대 링크/게스트 응답 기능이 필요하면 별도 토큰 전략으로 확장한다.