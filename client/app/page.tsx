"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, MAX_FILE_SIZE_MB, MAX_FILE_SIZE, AUDIO_FILE_EXTENSIONS } from "./constants";
import UploadingModal from "./components/UploadingModal";

export default function Home() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [vocalType, setVocalType] = useState<"female" | "male" | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isAudioFile = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    // 확장자만 엄격하게 체크 (MIME 타입 체크 제거)
    return AUDIO_FILE_EXTENSIONS.some(ext => fileName.endsWith(ext));
  };

  const isFileSizeValid = (file: File): boolean => {
    return file.size <= MAX_FILE_SIZE;
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      // 파일 형식 체크
      if (!isAudioFile(file)) {
        setErrorMessage("지원하지 않는 파일 형식입니다. (WAV, MP3, FLAC, OGG만 지원)");
        setSelectedFile(null);
        return;
      }
      
      // 파일 크기 체크
      if (!isFileSizeValid(file)) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        setErrorMessage(`파일 크기가 ${MAX_FILE_SIZE_MB}MB를 초과했습니다. (파일 크기: ${fileSizeMB}MB)`);
        setSelectedFile(null);
        return;
      }
      
      // 모든 검증 통과
      setSelectedFile(file);
      setVocalType(null); // 새 파일 선택 시 음역대 초기화
      setErrorMessage("");
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 파일 형식 체크
      if (!isAudioFile(file)) {
        setErrorMessage("지원하지 않는 파일 형식입니다. (WAV, MP3, FLAC, OGG만 지원)");
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }
      
      // 파일 크기 체크
      if (!isFileSizeValid(file)) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        setErrorMessage(`파일 크기가 ${MAX_FILE_SIZE_MB}MB를 초과했습니다. (파일 크기: ${fileSizeMB}MB)`);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }
      
      // 모든 검증 통과
      setSelectedFile(file);
      setVocalType(null); // 새 파일 선택 시 음역대 초기화
      setErrorMessage("");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !vocalType) return;

    // 업로드 전 최종 파일 크기 체크
    if (!isFileSizeValid(selectedFile)) {
      const fileSizeMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
      setErrorMessage(`파일 크기가 ${MAX_FILE_SIZE_MB}MB를 초과했습니다. (현재: ${fileSizeMB}MB)`);
      return;
    }

    setIsUploading(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("music_file", selectedFile);
      formData.append("vocal_type", vocalType);

      const response = await fetch(`${API_BASE_URL}/tracks/analyze`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        
        // sessionStorage에 임시 저장 (브라우저 탭 닫으면 자동 삭제됨)
        sessionStorage.setItem('sheetMusicData', JSON.stringify(data));
        
        // 업로드 성공 후 즉시 sheet-music 페이지로 리다이렉트
        // 모달을 유지한 채로 페이지 이동 (setIsUploading(false) 하지 않음)
        router.push("/sheet-music");
      } else {
        const errorData = await response.json().catch(() => ({}));
        setErrorMessage(errorData.message || "업로드에 실패했습니다.");
        setIsUploading(false); // 실패 시에만 모달 닫기
      }
    } catch (error) {
      console.error("Upload error:", error);
      setErrorMessage("서버와 통신 중 오류가 발생했습니다.");
      setIsUploading(false); // 에러 시에만 모달 닫기
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black font-sans">
      {/* 업로드 중 모달 */}
      <UploadingModal isOpen={isUploading} />

      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-black">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-zinc-50 mb-4">
              My Pitch
            </h1>
            <p className="text-lg leading-8 text-zinc-400 mb-6">
              부른 노래를 업로드하면 내 음정을 악보로 확인할 수 있어요
            </p>
          </div>

          {/* 사용 안내 - Accordion */}
          <div className="bg-blue-950/20 border border-blue-900 rounded-xl overflow-hidden">
            <button
              onClick={() => setIsGuideOpen(!isGuideOpen)}
              className="w-full p-4 flex items-center justify-between hover:bg-blue-900/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <svg
                  className="w-6 h-6 text-blue-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h2 className="text-lg font-semibold text-blue-300">
                  사용 안내
                </h2>
              </div>
              <svg
                className={`w-5 h-5 text-blue-400 transition-transform ${isGuideOpen ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M19 9l-7 7-7-7" 
                />
              </svg>
            </button>
            
            <div className={`transition-all duration-300 ease-in-out ${isGuideOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
              <div className="px-4 pb-4 pt-2 space-y-4">
                <p className="text-sm text-blue-300">
                  노래방에서 녹음한 음성으로 음높이를 확인하기 위한 서비스입니다
                </p>

                <div className="space-y-2 text-sm text-blue-300">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>악보는 <strong>노래방 악보처럼 간소화</strong>되어 표시됩니다</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>박자는 <strong>4/4박자로 고정</strong>되어 있습니다</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>모든 음표는 <strong>높은음자리표(G clef)로 통일</strong>되어 표시됩니다</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>복잡한 악보 규칙은 생략되어 <strong>음높이 확인에만 집중</strong>할 수 있습니다</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!selectedFile && (
            <div
              className={`relative border-2 border-dashed rounded-xl p-12 transition-all ${
                isDragging
                  ? "border-blue-500 bg-blue-950/20"
                  : "border-zinc-700 hover:border-zinc-600"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept=".wav,.mp3,.flac,.ogg"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center cursor-pointer"
              >
                <svg
                  className="w-16 h-16 mb-4 text-zinc-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
                <p className="text-lg font-medium text-zinc-300 mb-2">
                  음악 파일을 클릭하거나 드래그하여 선택
                </p>
                <p className="text-sm text-zinc-500">
                  WAV, MP3, FLAC, OGG 지원 · 최대 {MAX_FILE_SIZE_MB}MB
                </p>
              </label>
            </div>
          )}

          {selectedFile && (
            <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 space-y-6">
              {/* 파일 정보 */}
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setVocalType(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="ml-4 text-zinc-400 hover:text-zinc-300 cursor-pointer"
                  aria-label="파일 제거"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* 구분선 */}
              <div className="border-t border-zinc-800"></div>

              {/* 음역대 선택 */}
              <div>
                <p className="text-sm font-medium text-zinc-100 mb-1">
                  부르는 사람의 음역대
                </p>
                <p className="text-xs text-zinc-400 mb-4">
                  원곡이 아닌, 실제로 녹음된 목소리를 기준으로 선택하세요
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="vocalType"
                      value="male"
                      checked={vocalType === "male"}
                      onChange={(e) => setVocalType(e.target.value as "female" | "male")}
                      className="peer sr-only"
                    />
                    <div className="flex items-center justify-center gap-2 px-3 py-4 bg-zinc-800 border-2 border-zinc-700 rounded-xl transition-all peer-checked:border-blue-500 peer-checked:bg-blue-950/30 peer-checked:shadow-sm">
                      {/* 남성 심볼 ♂ */}
                      <svg
                        className="w-5 h-5 flex-shrink-0 text-zinc-500 peer-checked:text-blue-500"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M20 4v6h-2V7.425l-3.975 3.95q.475.7.725 1.488T15 14.5q0 2.3-1.6 3.9T9.5 20q-2.3 0-3.9-1.6T4 14.5q0-2.3 1.6-3.9T9.5 9q.825 0 1.625.237t1.475.738L16.575 6H14V4zM9.5 11q-1.45 0-2.475 1.025T6 14.5q0 1.45 1.025 2.475T9.5 18q1.45 0 2.475-1.025T13 14.5q0-1.45-1.025-2.475T9.5 11z"/>
                      </svg>
                      <span className="text-sm font-medium text-zinc-300 peer-checked:text-blue-400 whitespace-nowrap">
                        <span className="hidden sm:inline">남성 보컬</span>
                        <span className="sm:hidden">남성</span>
                      </span>
                    </div>
                  </label>
                  <label className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="vocalType"
                      value="female"
                      checked={vocalType === "female"}
                      onChange={(e) => setVocalType(e.target.value as "female" | "male")}
                      className="peer sr-only"
                    />
                    <div className="flex items-center justify-center gap-2 px-3 py-4 bg-zinc-800 border-2 border-zinc-700 rounded-xl transition-all peer-checked:border-pink-500 peer-checked:bg-pink-950/30 peer-checked:shadow-sm">
                      {/* 여성 심볼 ♀ */}
                      <svg
                        className="w-5 h-5 flex-shrink-0 text-zinc-500 peer-checked:text-pink-500"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2q2.075 0 3.538 1.462T17 7q0 1.8-1.137 3.175T13 11.9V14h2v2h-2v4h-2v-4H9v-2h2v-2.1q-1.725-.325-2.862-1.7T7 7q0-2.075 1.463-3.537T12 2m0 2Q10.75 4 9.875 4.875T9 7q0 1.25.875 2.125T12 10q1.25 0 2.125-.875T15 7q0-1.25-.875-2.125T12 4z"/>
                      </svg>
                      <span className="text-sm font-medium text-zinc-300 peer-checked:text-pink-400 whitespace-nowrap">
                        <span className="hidden sm:inline">여성 보컬</span>
                        <span className="sm:hidden">여성</span>
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 구분선 */}
              <div className="border-t border-zinc-800"></div>

              {/* 다른 파일 선택 버튼 */}
              <div>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept=".wav,.mp3,.flac,.ogg"
                  id="file-change"
                />
                <label
                  htmlFor="file-change"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-750 cursor-pointer transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  다른 파일 선택
                </label>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-950/20 border border-red-800 rounded-lg p-4">
              <p className="text-sm font-medium text-red-300">
                {errorMessage}
              </p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!selectedFile || !vocalType || isUploading}
            className={`w-full h-12 rounded-full font-medium transition-colors ${
              selectedFile && vocalType && !isUploading
                ? "bg-white text-black hover:bg-zinc-200 cursor-pointer"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            }`}
          >
            {isUploading ? "변환 중..." : "악보로 변환"}
          </button>
        </div>
      </main>
    </div>
  );
}
