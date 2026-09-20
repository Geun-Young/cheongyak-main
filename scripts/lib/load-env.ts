/**
 * `.env.local`을 스크립트에서도 읽는다.
 *
 * `next dev`/`next build`는 .env* 파일을 알아서 읽어주지만, `tsx scripts/...`로 직접
 * 실행할 때는 아무도 안 읽어준다 — 그래서 스크립트만 "환경변수가 필요해요"로 죽는다.
 * Next가 내부적으로 쓰는 @next/env를 그대로 써서 로드 순서(.env.local > .env 등)를
 * `next dev`와 똑같이 맞춘다. 새 의존성을 깔 필요가 없다(Next가 이미 갖고 있다).
 *
 * import 하는 것만으로 동작한다. **반드시 process.env를 읽는 코드보다 먼저** 와야 해서,
 * 각 스크립트의 첫 import로 둔다.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
