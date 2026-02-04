interface UploadingModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
}

export default function UploadingModal({ 
  isOpen, 
  title = "악보로 변환 중입니다",
  message = "잠시만 기다려주세요..."
}: UploadingModalProps) {
  if (!isOpen) return null;

  return (
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
      <div className="bg-zinc-900 rounded-2xl p-8 shadow-2xl border border-zinc-800 max-w-sm w-full mx-4">
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
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">
              {title}
            </h3>
            <p className="text-sm text-zinc-400">
              {message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

