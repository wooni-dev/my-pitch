"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = "https://melinda-subtemperate-grace.ngrok-free.dev";

export default function Home() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const audioFileExtensions = [".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".wma", ".opus"];
  
  const isAudioFile = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    return audioFileExtensions.some(ext => fileName.endsWith(ext)) || file.type.startsWith("audio/");
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
      if (isAudioFile(file)) {
        setSelectedFile(file);
        setUploadStatus("idle");
        setErrorMessage("");
      } else {
        setErrorMessage("음악 파일만 업로드할 수 있습니다. (MP3, WAV, FLAC, M4A, AAC, OGG 등)");
        setSelectedFile(null);
      }
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isAudioFile(file)) {
        setSelectedFile(file);
        setUploadStatus("idle");
        setErrorMessage("");
      } else {
        setErrorMessage("음악 파일만 업로드할 수 있습니다. (MP3, WAV, FLAC, M4A, AAC, OGG 등)");
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadStatus("idle");

    try {
      const formData = new FormData();
      formData.append("music_file", selectedFile);

      const response = await fetch(`${API_BASE_URL}/upload_music`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setUploadStatus("success");
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        // 업로드 성공 후 sheet-music 페이지로 리다이렉트
        router.push("/sheet-music");
      } else {
        setUploadStatus("error");
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus("error");
    } finally {
      setIsUploading(false);
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
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-black dark:text-zinc-50 mb-4">
              음악 파일 업로드
            </h1>
            <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              음악 파일을 선택하거나 드래그하여 업로드하세요
            </p>
          </div>

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
              accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.wma,.opus"
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
                MP3, WAV, FLAC, M4A, AAC, OGG 등 지원
              </p>
            </label>
          </div>

          {selectedFile && (
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-6 border border-zinc-200 dark:border-zinc-800">
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
                    setUploadStatus("idle");
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="ml-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
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
            </div>
          )}

          {uploadStatus === "success" && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                파일이 성공적으로 업로드되었습니다!
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                {errorMessage}
              </p>
            </div>
          )}

          {uploadStatus === "error" && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                업로드 중 오류가 발생했습니다. 다시 시도해주세요.
              </p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className={`w-full h-12 rounded-full font-medium transition-colors ${
              selectedFile && !isUploading
                ? "bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                : "bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600"
            }`}
          >
            {isUploading ? "업로드 중..." : "업로드"}
          </button>
        </div>
      </main>
    </div>
  );
}
