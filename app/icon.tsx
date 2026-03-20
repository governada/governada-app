import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0b14',
        borderRadius: 6,
      }}
    >
      <svg viewBox="0 0 100 100" width="26" height="26">
        <path
          d="M 60 20 A 32 32 0 1 0 73 54"
          fill="none"
          stroke="#4EEAC6"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <line
          x1="73"
          y1="54"
          x2="52"
          y2="48"
          stroke="#4EEAC6"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <circle cx="60" cy="20" r="5" fill="#4EEAC6" />
        <circle cx="38" cy="14" r="5" fill="#4EEAC6" />
        <circle cx="18" cy="25" r="5" fill="#4EEAC6" />
        <circle cx="10" cy="46" r="5" fill="#4EEAC6" />
        <circle cx="18" cy="67" r="5" fill="#4EEAC6" />
        <circle cx="38" cy="78" r="5" fill="#4EEAC6" />
        <circle cx="60" cy="73" r="5" fill="#4EEAC6" />
        <circle cx="73" cy="54" r="5" fill="#4EEAC6" />
        <circle cx="55" cy="34" r="4.5" fill="#4EEAC6" />
        <circle cx="52" cy="48" r="5" fill="#4EEAC6" />
        <line
          x1="38"
          y1="14"
          x2="55"
          y2="34"
          stroke="#4EEAC6"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <line
          x1="55"
          y1="34"
          x2="52"
          y2="48"
          stroke="#4EEAC6"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    </div>,
    { ...size },
  );
}
