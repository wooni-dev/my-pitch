# VexFlow 사용 가이드

이 문서는 `client/app` 폴더에서 사용되는 VexFlow 함수와 상수들을 정리한 문서입니다.

## 목차
- [클래스](#클래스)
- [메서드](#메서드)
- [상수](#상수)
- [사용 예제](#사용-예제)

---

## 클래스

### 1. Renderer
**용도**: SVG 렌더러 생성 및 캔버스 관리

```typescript
const renderer = new Renderer(
  containerRef.current,      // HTML 컨테이너 요소
  Renderer.Backends.SVG      // 백엔드 타입 (SVG)
);
```

**주요 메서드**:
- `resize(width, height)`: 캔버스 크기 설정
- `getContext()`: 렌더링 컨텍스트 가져오기

**사용 위치**: `client/app/sheet-music/page.tsx:31-34`

---

### 2. Stave
**용도**: 마디(5선보) 생성 및 관리

```typescript
const stave = new Stave(x, y, width);
```

**파라미터**:
- `x`: X 좌표 (가로 위치)
- `y`: Y 좌표 (세로 위치)
- `width`: 마디 너비 (px)

**주요 메서드**:

#### `addClef(clef: string)`
높은음자리표, 낮은음자리표 등 추가
```typescript
stave.addClef("treble");  // 높은음자리표 (🎼)
stave.addClef("bass");    // 낮은음자리표
```

#### `addKeySignature(keySignature: string)`
조표 추가
```typescript
stave.addKeySignature("C");   // C major (조표 없음)
stave.addKeySignature("Bb");  // Bb major (플랫 2개)
stave.addKeySignature("F#");  // F# major (샾 6개)
```

#### `setContext(context).draw()`
컨텍스트 설정 및 마디 그리기
```typescript
stave.setContext(context).draw();
```
**주의**: 이 시점에 마디가 SVG에 실제로 그려집니다.

#### `getNoteStartX()`
음표가 배치될 수 있는 시작 X 좌표 반환
```typescript
const noteStartX = stave.getNoteStartX();  // 예: 60px
```
- clef, 조표 등을 고려한 위치
- 음표의 유무와 무관하게 항상 같은 값 반환
- clef가 있으면 더 큰 값, 없으면 기본 여백 값

#### `getX()`
마디의 시작 X 좌표 반환
```typescript
const x = stave.getX();  // 예: 0px
```

#### `getWidth()`
마디의 너비 반환
```typescript
const width = stave.getWidth();  // 예: 950px
```

**사용 위치**: `client/app/sheet-music/utils/staveUtils.ts`, `client/app/sheet-music/page.tsx`

---

### 3. StaveNote
**용도**: 음표 생성

```typescript
const note = new StaveNote({ 
  keys: ["c/4"],    // 음높이 (C4 = 가운데 도)
  duration: "q"     // 음표 길이
});
```

**keys 포맷**: `"{음이름}/{옥타브}"`
- 음이름: `c`, `d`, `e`, `f`, `g`, `a`, `b` (도레미파솔라시)
- 샾: `c#`, `d#` 등
- 플랫: `cb`, `db` 등
- 옥타브: 숫자 (4 = 가운데 옥타브)

**duration 값**:
| 코드 | 이름 | 박자 | 기호 |
|------|------|------|------|
| `"w"` | whole note (전음표) | 4박 | 𝅝 |
| `"h"` | half note (2분음표) | 2박 | 𝅗𝅥 |
| `"q"` | quarter note (4분음표) | 1박 | ♩ |
| `"8"` | eighth note (8분음표) | 0.5박 | ♪ |
| `"16"` | sixteenth note (16분음표) | 0.25박 | 𝅘𝅥𝅯 |

**사용 위치**: `client/app/sheet-music/page.tsx:64-67`

---

### 4. Voice
**용도**: 음표 그룹(성부) 관리 및 박자 검증

```typescript
const voice = new Voice({ 
  numBeats: 4,    // 한 마디에 몇 박자 (4박자)
  beatValue: 4    // 몇 분음표가 1박인지 (4분음표 = 1박)
});
```

**박자 설정**:
- `{ numBeats: 4, beatValue: 4 }` → 4/4 박자
- `{ numBeats: 3, beatValue: 4 }` → 3/4 박자
- `{ numBeats: 6, beatValue: 8 }` → 6/8 박자

**주요 메서드**:

#### `addTickables(notes: StaveNote[])`
음표 배열을 voice에 추가
```typescript
voice.addTickables([note1, note2, note3, note4]);
```
**검증**: 추가된 음표들의 총 길이가 박자에 맞지 않으면 에러 발생

#### `draw(context, stave)`
음표들을 마디에 그리기
```typescript
voice.draw(context, stave);
```

**사용 위치**: `client/app/sheet-music/page.tsx:70-74, 82`

---

### 5. Formatter
**용도**: 음표들의 위치를 계산하고 균등하게 배치

```typescript
const formatter = new Formatter();
```

**주요 메서드**:

#### `joinVoices(voices: Voice[])`
여러 voice를 하나로 결합 (화음, 다성부 음악)
```typescript
formatter.joinVoices([voice1, voice2]);
```

#### `format(voices: Voice[], width: number)`
음표들의 X 좌표를 계산
```typescript
formatter.format([voice], 870);  // 870px 내에서 음표 배치
```
- `voices`: 포맷할 voice 배열
- `width`: 음표를 배치할 전체 너비 (px)
- 음표들을 주어진 너비 내에서 균등하게 배치

**메서드 체이닝**:
```typescript
new Formatter()
  .joinVoices([voice])
  .format([voice], noteSpaceWidth);
```

**사용 위치**: `client/app/sheet-music/page.tsx:81`

---

### 6. StaveConnector
**용도**: 마디들을 세로선으로 연결

```typescript
const connector = new StaveConnector(stave1, stave2);
```

**주요 메서드**:

#### `setType(type)`
연결선 타입 설정
```typescript
connector.setType(StaveConnector.type.SINGLE_LEFT);
```

**타입 종류**:
| 타입 | 설명 | 용도 |
|------|------|------|
| `SINGLE_LEFT` | 왼쪽 단일 선 | 일반 악보 |
| `SINGLE_RIGHT` | 오른쪽 단일 선 | - |
| `DOUBLE` | 양쪽 이중 선 | 악보 끝 |
| `BRACE` | 중괄호 | 피아노 악보 |
| `BRACKET` | 대괄호 | 합창/오케스트라 |

#### `setContext(context).draw()`
컨텍스트 설정 및 연결선 그리기
```typescript
connector.setContext(context).draw();
```

**사용 위치**: `client/app/sheet-music/page.tsx:87-89`

---

## 상수

### STAVE_HEIGHT
**값**: `90` (px)  
**의미**: VexFlow 마디의 기본 높이  
**위치**: `client/app/sheet-music/utils/constants.ts:2`

```typescript
export const STAVE_HEIGHT = 90;
```

**사용 예**:
```typescript
// 마디 10개의 전체 높이
const totalHeight = STAVE_HEIGHT * 10;  // 900px

// Y 좌표 계산
const y = STAVE_HEIGHT * i;  // i번째 마디
```

---

### STAVE_WIDTH_OFFSET
**값**: `17` (px)  
**의미**: 마디 오른쪽 세로선을 보이게 하는 너비 보정값  
**위치**: `client/app/sheet-music/utils/constants.ts:5`

```typescript
export const STAVE_WIDTH_OFFSET = 17;
```

**사용 예**:
```typescript
const stave = new Stave(
  0, 
  0, 
  containerWidth - STAVE_WIDTH_OFFSET  // 오른쪽 여백 확보
);
```

---

## 메서드 상세 설명

### 레이아웃 계산 관련

#### getNoteStartX()
음표 배치 영역의 시작 X 좌표를 반환합니다.

**특징**:
- 음표의 유무와 무관하게 항상 같은 값 반환
- Stave의 레이아웃 정보 (clef, 조표 고려)
- clef가 있으면 더 큰 값 (예: 60px)
- clef가 없으면 기본 여백 값 (예: 10px)

**계산 예시**:
```typescript
// clef 있음
const stave1 = new Stave(0, 0, 500);
stave1.addClef("treble");
stave1.getNoteStartX();  // 60px (clef + 여백)

// clef 없음
const stave2 = new Stave(0, 0, 500);
stave2.getNoteStartX();  // 10px (기본 여백만)
```

#### clef 너비 계산
```typescript
// 1. 기본 여백 구하기
const tempStave = new Stave(x, y, width);
const basePadding = tempStave.getNoteStartX() - tempStave.getX();
// basePadding ≈ 10px

// 2. 실제 stave 생성
const stave = new Stave(x, y, width);
stave.addClef("treble");

// 3. clef 너비 계산
const noteStartX = stave.getNoteStartX();  // 60px
const clefWidth = noteStartX - stave.getX() - basePadding;
// clefWidth = 60 - 0 - 10 = 50px (순수 clef 공간)
```

---

## 사용 예제

### 기본 악보 그리기

```typescript
// 1. 렌더러 생성
const renderer = new Renderer(containerElement, Renderer.Backends.SVG);
renderer.resize(800, 200);
const context = renderer.getContext();

// 2. 마디 생성
const stave = new Stave(10, 40, 400);
stave.addClef("treble");
stave.addKeySignature("C");
stave.setContext(context).draw();

// 3. 음표 생성
const notes = [
  new StaveNote({ keys: ["c/4"], duration: "q" }),
  new StaveNote({ keys: ["d/4"], duration: "q" }),
  new StaveNote({ keys: ["e/4"], duration: "q" }),
  new StaveNote({ keys: ["f/4"], duration: "q" })
];

// 4. Voice 생성 및 음표 추가
const voice = new Voice({ numBeats: 4, beatValue: 4 });
voice.addTickables(notes);

// 5. 포맷팅 및 그리기
new Formatter().joinVoices([voice]).format([voice], 400);
voice.draw(context, stave);
```

---

### 여러 마디 그리기 (세로 배치)

```typescript
const staveCount = 5;
const staves = [];

for (let i = 0; i < staveCount; i++) {
  // 마디 생성 (Y 위치를 STAVE_HEIGHT * i로 설정)
  const stave = new Stave(0, STAVE_HEIGHT * i, 800);
  
  // 첫 마디만 clef 표시
  if (i === 0) {
    stave.addClef("treble");
  }
  
  stave.setContext(context).draw();
  staves.push(stave);
  
  // 음표 추가
  const notes = [/* ... */];
  const voice = new Voice({ numBeats: 4, beatValue: 4 });
  voice.addTickables(notes);
  
  new Formatter().joinVoices([voice]).format([voice], 750);
  voice.draw(context, stave);
}

// 마디 연결선 그리기
for (let i = 0; i < staveCount - 1; i++) {
  const connector = new StaveConnector(staves[i], staves[i + 1]);
  connector.setType(StaveConnector.type.SINGLE_LEFT);
  connector.setContext(context).draw();
}
```

---

### 음표 배치 공간 계산

```typescript
const stave = new Stave(0, 0, containerWidth);
stave.addClef("treble");
stave.setContext(context).draw();

// 음표 시작 위치
const noteStartX = stave.getNoteStartX();  // clef 끝나는 지점

// 마디 끝 위치
const staveEndX = stave.getX() + stave.getWidth();

// 음표 배치 가능 공간 (오른쪽 여백 20px 제외)
const noteSpaceWidth = staveEndX - noteStartX - 20;

// 이 너비를 Formatter에 전달
new Formatter().joinVoices([voice]).format([voice], noteSpaceWidth);
```

---

## 렌더링 순서

VexFlow에서 악보를 그리는 순서는 중요합니다:

1. **Renderer 생성 및 크기 설정**
   ```typescript
   const renderer = new Renderer(container, Renderer.Backends.SVG);
   renderer.resize(width, height);
   const context = renderer.getContext();
   ```

2. **Stave 생성 및 그리기**
   ```typescript
   const stave = new Stave(x, y, width);
   stave.addClef("treble");
   stave.setContext(context).draw();  // ← 마디가 그려짐
   ```

3. **음표 생성**
   ```typescript
   const notes = [new StaveNote({...}), ...];
   ```

4. **Voice 생성 및 음표 추가**
   ```typescript
   const voice = new Voice({ numBeats: 4, beatValue: 4 });
   voice.addTickables(notes);
   ```

5. **음표 위치 계산 (Formatter)**
   ```typescript
   new Formatter().joinVoices([voice]).format([voice], width);
   ```

6. **음표 그리기**
   ```typescript
   voice.draw(context, stave);  // ← 음표가 그려짐
   ```

7. **마디 연결선 (선택적)**
   ```typescript
   const connector = new StaveConnector(stave1, stave2);
   connector.setType(StaveConnector.type.SINGLE_LEFT);
   connector.setContext(context).draw();
   ```

---

## 주의사항

### 1. Stave는 draw() 후에도 정보 조회 가능
```typescript
const stave = new Stave(0, 0, 500);
stave.addClef("treble");
stave.setContext(context).draw();

// draw() 후에도 메서드 호출 가능
const noteStartX = stave.getNoteStartX();  // ✅ 가능
const width = stave.getWidth();            // ✅ 가능
```

### 2. 음표의 유무는 getNoteStartX()에 영향 없음
```typescript
const stave = new Stave(0, 0, 500);
console.log(stave.getNoteStartX());  // 10px

// 음표 추가 후에도 같음
voice.draw(context, stave);
console.log(stave.getNoteStartX());  // 10px (변화 없음)
```

### 3. Voice는 박자를 검증함
```typescript
const voice = new Voice({ numBeats: 4, beatValue: 4 });  // 4/4 박자

// 4박자를 넘으면 에러!
voice.addTickables([
  new StaveNote({ keys: ["c/4"], duration: "q" }),  // 1박
  new StaveNote({ keys: ["d/4"], duration: "q" }),  // 1박
  new StaveNote({ keys: ["e/4"], duration: "q" }),  // 1박
  new StaveNote({ keys: ["f/4"], duration: "q" }),  // 1박
  new StaveNote({ keys: ["g/4"], duration: "q" })   // 1박 → 총 5박! ❌
]);
```

### 4. Formatter는 메서드 체이닝 지원
```typescript
// 가능
new Formatter().joinVoices([voice]).format([voice], width);

// 또는 분리
const formatter = new Formatter();
formatter.joinVoices([voice]);
formatter.format([voice], width);
```

---

## 참고 자료

- **VexFlow 공식 문서**: https://github.com/0xfe/vexflow
- **VexFlow 튜토리얼**: https://github.com/0xfe/vexflow/wiki
- **VexFlow API**: https://github.com/0xfe/vexflow/wiki/VexFlow-API-Reference

---

## 버전 정보

- VexFlow: 최신 버전 (package.json 참조)
- 작성일: 2026-01-27
- 프로젝트: my-pitch

