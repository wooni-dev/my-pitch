"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, MAX_FILE_SIZE_MB, MAX_FILE_SIZE, AUDIO_FILE_EXTENSIONS } from "./constants";

export default function Home() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [vocalType, setVocalType] = useState<"female" | "male" | null>(null);
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

      const response = await fetch(`${API_BASE_URL}/v1/tracks/analyze`, {
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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      {/* 업로드 중 모달 */}
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <style dangerouslySetInnerHTML={{
            __html: `
              @keyframes spinner-rotate {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              @keyframes spinner-dash {
                0% {
                  stroke-dasharray: 1, 150;
                  stroke-dashoffset: 0;
                }
                50% {
                  stroke-dasharray: 90, 150;
                  stroke-dashoffset: -35;
                }
                100% {
                  stroke-dasharray: 90, 150;
                  stroke-dashoffset: -124;
                }
              }
            `
          }} />
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-sm w-full mx-4">
            <div className="flex flex-col items-center space-y-4">
              {/* 로딩 스피너 */}
              <div className="relative w-16 h-16">
                <svg 
                  className="w-full h-full"
                  viewBox="0 0 50 50"
                  style={{
                    animation: 'spinner-rotate 2s linear infinite'
                  }}
                >
                  <circle
                    cx="25"
                    cy="25"
                    r="20"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="4"
                    strokeLinecap="round"
                    style={{
                      animation: 'spinner-dash 1.5s ease-in-out infinite'
                    }}
                  />
                </svg>
              </div>
              {/* 메시지 */}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  악보로 변환 중입니다
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  잠시만 기다려주세요...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-black dark:text-zinc-50 mb-4">
              My Pitch
            </h1>
            <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              부른 노래를 업로드하면 내 음정을 악보로 확인할 수 있어요
            </p>
          </div>

          {!selectedFile && (
            <div
              className={`relative border-2 border-dashed rounded-xl p-12 transition-all ${
                isDragging
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                  : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
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
                  className="w-16 h-16 mb-4 text-zinc-400 dark:text-zinc-600"
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
                <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  음악 파일을 클릭하거나 드래그하여 선택
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-500">
                  WAV, MP3, FLAC, OGG 지원 · 최대 {MAX_FILE_SIZE_MB}MB
                </p>
              </label>
            </div>
          )}

          {selectedFile && (
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-6 border border-zinc-200 dark:border-zinc-800 space-y-6">
              {/* 파일 정보 */}
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
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
                  className="ml-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
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
              <div className="border-t border-zinc-200 dark:border-zinc-800"></div>

              {/* 음역대 선택 */}
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                  부르는 사람의 음역대
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                  원곡이 아닌, 실제로 녹음된 목소리를 기준으로 선택하세요
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="vocalType"
                      value="female"
                      checked={vocalType === "female"}
                      onChange={(e) => setVocalType(e.target.value as "female" | "male")}
                      className="peer sr-only"
                    />
                    <div className="flex items-center gap-3 px-4 py-4 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl transition-all hover:border-zinc-300 dark:hover:border-zinc-600 peer-checked:border-pink-500 peer-checked:bg-pink-50 dark:peer-checked:bg-pink-950/30 peer-checked:shadow-sm">
                      <svg
                        className="w-5 h-5 text-zinc-400 dark:text-zinc-500 peer-checked:text-pink-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 peer-checked:text-pink-700 dark:peer-checked:text-pink-400">
                        여성 보컬
                      </span>
                      {vocalType === "female" && (
                        <svg
                          className="w-5 h-5 text-pink-500 ml-auto"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </label>
                  <label className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="vocalType"
                      value="male"
                      checked={vocalType === "male"}
                      onChange={(e) => setVocalType(e.target.value as "female" | "male")}
                      className="peer sr-only"
                    />
                    <div className="flex items-center gap-3 px-4 py-4 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl transition-all hover:border-zinc-300 dark:hover:border-zinc-600 peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-950/30 peer-checked:shadow-sm">
                      <svg
                        className="w-5 h-5 text-zinc-400 dark:text-zinc-500 peer-checked:text-blue-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 peer-checked:text-blue-700 dark:peer-checked:text-blue-400">
                        남성 보컬
                      </span>
                      {vocalType === "male" && (
                        <svg
                          className="w-5 h-5 text-blue-500 ml-auto"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* 구분선 */}
              <div className="border-t border-zinc-200 dark:border-zinc-800"></div>

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
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 cursor-pointer transition-colors"
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
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                {errorMessage}
              </p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!selectedFile || !vocalType || isUploading}
            className={`w-full h-12 rounded-full font-medium transition-colors ${
              selectedFile && vocalType && !isUploading
                ? "bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 cursor-pointer"
                : "bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600"
            }`}
          >
            {isUploading ? "변환 중..." : "악보로 변환"}
          </button>
        </div>
      </main>
    </div>
  );
}
