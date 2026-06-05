import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#1b3a5c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="140" height="140" viewBox="0 0 100 100">
          <g
            fill="none"
            stroke="#c9a84c"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="50" cy="22" r="6" />
            <path d="M 50 28 L 50 82" />
            <path d="M 38 40 L 62 40" />
            <path d="M 22 60 C 22 78 38 82 50 82 C 62 82 78 78 78 60" />
            <path d="M 22 60 L 14 56" />
            <path d="M 78 60 L 86 56" />
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
