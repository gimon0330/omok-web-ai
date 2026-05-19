# Mobile Gomoku AI MVP

모바일 웹에서 바로 실행되는 오목 AI MVP입니다.

## 실행 방법

아무 서버 없이 `index.html`을 브라우저로 열어도 됩니다.

또는 로컬 서버로 실행:

```bash
python -m http.server 8000
```

그리고 접속:

```text
http://localhost:8000
```

## 구성

- `index.html`: 앱 구조
- `style.css`: 모바일 반응형 UI
- `app.js`: 오목 rule, canvas board, 간단한 AI

## AI 구조

현재 AI는 다음을 사용합니다.

- Candidate move generation
- 1-move win/block tactical check
- Negamax
- Alpha-Beta pruning
- Pattern-based evaluation

강화 방향:

1. Transposition Table 추가
2. Iterative Deepening 추가
3. Threat-Space Search 추가
4. Web Worker 분리
5. NNUE 또는 작은 neural evaluator 연결
6. Renju 금수 rule 추가
