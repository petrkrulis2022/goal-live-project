import React, { useEffect } from "react";

interface GoalWinCelebrationProps {
  playerName: string;
  onClose: () => void;
}

export const GoalWinCelebration: React.FC<GoalWinCelebrationProps> = ({
  playerName,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="gl-interactive fixed inset-0 z-[2147483647] flex items-center justify-center pointer-events-auto"
      style={{
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center justify-center"
        style={{
          animation: "gl-celebrate 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        }}
      >
        <div
          className="rounded-3xl border-4 border-yellow-300 px-12 py-8 text-center shadow-2xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(34,197,94,0.95) 0%, rgba(22,163,74,0.95) 100%)",
            boxShadow:
              "0 0 60px rgba(34,197,94,0.8), 0 0 120px rgba(34,197,94,0.4)",
          }}
        >
          <div
            className="absolute inset-0 text-4xl font-black pointer-events-none"
            style={{
              overflow: "hidden",
              borderRadius: "24px",
            }}
          >
            <div
              className="absolute"
              style={{
                left: "10%",
                top: "10%",
                animation: "gl-float 2s ease-in-out infinite",
              }}
            >
              ⚽
            </div>
            <div
              className="absolute"
              style={{
                right: "15%",
                top: "15%",
                animation: "gl-float 2.5s ease-in-out infinite 0.3s",
              }}
            >
              🎉
            </div>
            <div
              className="absolute"
              style={{
                left: "20%",
                bottom: "10%",
                animation: "gl-float 2.2s ease-in-out infinite 0.6s",
              }}
            >
              ✨
            </div>
            <div
              className="absolute"
              style={{
                right: "10%",
                bottom: "15%",
                animation: "gl-float 2.8s ease-in-out infinite 0.2s",
              }}
            >
              🔥
            </div>
          </div>

          <div className="relative z-10">
            <p
              className="text-5xl font-black text-white mb-2"
              style={{
                textShadow: "0 4px 12px rgba(0,0,0,0.5)",
              }}
            >
              YOU WON!!!
            </p>

            <p className="text-lg font-bold text-white/90 mt-4">
              {playerName} scored the next goal
            </p>

            <div
              style={{
                marginTop: "16px",
                fontSize: "32px",
                animation: "gl-pulse 1.5s ease-in-out infinite",
              }}
            >
              ⭐
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gl-celebrate {
          0% {
            transform: scale(0.5) rotate(-5deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.1) rotate(2deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }

        @keyframes gl-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.7;
          }
        }

        @keyframes gl-float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(5deg);
          }
        }
      `}</style>
    </div>
  );
};
