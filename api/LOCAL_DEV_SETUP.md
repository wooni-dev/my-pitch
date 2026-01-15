# 로컬 개발 환경 설정 가이드

## 🎯 왜 필요한가?

Docker 컨테이너에서는 코드가 정상 실행되지만, **로컬 IDE(Cursor, VSCode)에서 코드 작성 시** import 에러가 발생합니다.

```python
from flask_cors import CORS  # ❌ Import "flask_cors" could not be resolved
```

IDE가 패키지를 인식하려면 로컬에 가상환경이 필요합니다.

## 📦 파일 설명

| 파일 | 용도 | Docker 사용 |
|------|------|------------|
| `.python-version` | pyenv가 Python 버전 지정 | ❌ |
| `venv/` | 로컬 가상환경 (패키지 설치) | ❌ |
| `requirements.txt` | 패키지 목록 | ✅ |

**중요**: `.python-version`과 `venv/`는 **로컬 IDE 자동완성용**입니다!

## 🚀 설정 방법

### 1단계: Python 3.11.9 설치

#### 옵션 A: pyenv 사용 (권장)

**Windows (PowerShell 관리자 권한):**
```powershell
# pyenv-win 설치
Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/pyenv-win/pyenv-win/master/pyenv-win/install-pyenv-win.ps1" -OutFile "./install-pyenv-win.ps1"; &"./install-pyenv-win.ps1"
```

**설치 후:**
```bash
# Python 3.11.9 설치
pyenv install 3.11.9

# api 폴더로 이동
cd api

# 이 프로젝트에서 3.11.9 사용
pyenv local 3.11.9
```

#### 옵션 B: 직접 설치

1. https://www.python.org/downloads/ 접속
2. Python 3.11.9 다운로드
3. 설치 시 **"Add Python to PATH"** 체크 ✅

### 2단계: 가상환경 생성

```bash
# api 폴더에서 실행
cd api

# 가상환경 생성
python -m venv venv
```

### 3단계: 가상환경 활성화

**Git Bash:**
```bash
source venv/Scripts/activate
```

**PowerShell:**
```powershell
venv\Scripts\Activate.ps1
```

**CMD:**
```cmd
venv\Scripts\activate.bat
```

**활성화 확인**: 터미널에 `(venv)` 표시

```bash
(venv) D:\github\my-pitch\api>
```

### 4단계: Python 버전 확인 ⚠️

```bash
python --version
```

**출력이 `Python 3.11.9`이어야 합니다!**

### 5단계: 패키지 설치

```bash
# pip 업그레이드
python -m pip install --upgrade pip

# requirements.txt의 모든 패키지 설치
pip install -r requirements.txt
```

설치 완료까지 1-2분 소요됩니다.

### 6단계: 설치 확인

```bash
pip list

# 출력:
# flask         3.1.1
# flask-cors    6.0.2
# librosa       0.11.0
# ...
```

## 🎨 IDE 설정 (Cursor/VSCode)

### Python 인터프리터 선택

1. **`Ctrl + Shift + P`**
2. **"Python: Select Interpreter"** 입력
3. `.\venv\Scripts\python.exe` 선택

또는 하단 상태바에서 Python 버전 클릭

### 확인

```python
from flask_cors import CORS  # ✅ 에러 없음, 자동완성 작동!
```

## ✅ 완료 체크리스트

- [ ] Python 3.11.9 설치됨
- [ ] `venv/` 폴더 생성됨
- [ ] 가상환경 활성화됨 `(venv)` 표시
- [ ] `python --version` → `Python 3.11.9`
- [ ] `pip list` → flask, librosa 등 표시됨
- [ ] IDE에서 import 에러 사라짐

## 🔄 일상적인 사용

### 터미널 열 때마다

```bash
cd api
source venv/Scripts/activate  # 가상환경 활성화
```

`.vscode/settings.json` 설정이 되어있으면 자동으로 활성화됩니다.

### 패키지 추가 시

```bash
# 1. requirements.txt에 패키지 추가
echo "new-package==1.0.0" >> requirements.txt

# 2. 로컬 가상환경에 설치
pip install -r requirements.txt

# 3. Docker 컨테이너 재빌드
cd ..
docker-compose up -d --build api
```

## 🐳 Docker와의 관계

```
┌─────────────────────────────────────┐
│  로컬 개발 환경                        │
│  ├── Python 3.11.9 (pyenv)           │
│  ├── venv/ (로컬 패키지)               │
│  └── 목적: IDE 자동완성, 타입힌트      │
└─────────────────────────────────────┘
              ↓ 코드 작성
┌─────────────────────────────────────┐
│  Docker 컨테이너                       │
│  ├── Python 3.11.9 (이미지)           │
│  ├── 패키지 (독립 설치)                │
│  └── 목적: 실제 실행 환경              │
└─────────────────────────────────────┘
```

- **로컬**: IDE에서 코드 작성, 자동완성
- **Docker**: 실제 애플리케이션 실행

**두 환경은 완전히 독립적입니다!**

## 🐛 문제 해결

### Import 에러가 계속 발생

```bash
# 1. 가상환경 활성화 확인
# 터미널에 (venv) 표시되어야 함

# 2. Python 버전 확인
python --version  # 3.11.9 이어야 함

# 3. IDE 인터프리터 재선택
# Ctrl+Shift+P → Python: Select Interpreter

# 4. IDE 재시작
# Ctrl+Shift+P → Developer: Reload Window
```

### pyenv 명령어를 찾을 수 없음

```bash
# 새 터미널 열기 (환경변수 갱신)
# 또는 옵션 B로 직접 Python 설치
```

### 가상환경 활성화 안됨 (PowerShell)

```powershell
# 실행 정책 변경 (관리자 권한)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# 다시 활성화 시도
venv\Scripts\Activate.ps1
```

## 💡 팁

### 빠른 명령어

```bash
# 가상환경 활성화 + Python 버전 확인 + 패키지 목록
cd api && source venv/Scripts/activate && python --version && pip list
```

### Git 제외 확인

```bash
# venv는 Git에 올라가면 안됨!
git status
# venv/ 폴더가 표시되지 않아야 함
```

루트의 `.gitignore`에 `**/venv/`가 설정되어 있어서 자동 제외됩니다.

## 📚 요약

1. ✅ Python 3.11.9 설치
2. ✅ `python -m venv venv` 가상환경 생성
3. ✅ `source venv/Scripts/activate` 활성화
4. ✅ `pip install -r requirements.txt` 패키지 설치
5. ✅ IDE에서 Python 인터프리터 선택

**이제 로컬에서 코드 작성 시 자동완성이 작동합니다!** 🎉

