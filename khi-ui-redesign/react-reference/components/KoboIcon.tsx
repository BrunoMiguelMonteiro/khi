interface KoboIconProps {
  dashed?: boolean;
  disabled?: boolean;
  className?: string;
}

export function KoboIcon({ dashed = false, disabled = false, className = '' }: KoboIconProps) {
  const strokeDasharray = dashed ? '4 4' : undefined;
  const opacity = disabled ? 0.5 : 1;
  const strokeColor = disabled 
    ? 'stroke-neutral-300 dark:stroke-neutral-700' 
    : 'stroke-neutral-900 dark:stroke-neutral-100';

  return (
    <div className={`flex justify-center ${className}`}>
      <svg
        width="140"
        height="180"
        viewBox="0 0 140 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity }}
      >
        {/* Ultra-minimal tablet-style e-reader */}
        <rect
          x="15"
          y="20"
          width="110"
          height="140"
          rx="8"
          className={strokeColor}
          strokeWidth="2.5"
          strokeDasharray={strokeDasharray}
        />
        
        {/* Full-screen display */}
        <rect
          x="22"
          y="27"
          width="96"
          height="126"
          rx="3"
          className={strokeColor}
          strokeWidth="1.5"
          strokeDasharray={strokeDasharray}
        />
        
        {/* Book page representation */}
        <line
          x1="35"
          y1="45"
          x2="78"
          y2="45"
          className={strokeColor}
          strokeWidth="1.5"
          strokeDasharray={strokeDasharray}
        />
        <line
          x1="35"
          y1="59"
          x2="103"
          y2="59"
          className={strokeColor}
          strokeWidth="1.5"
          strokeDasharray={strokeDasharray}
        />
        <line
          x1="35"
          y1="73"
          x2="98"
          y2="73"
          className={strokeColor}
          strokeWidth="1.5"
          strokeDasharray={strokeDasharray}
        />
        <line
          x1="35"
          y1="87"
          x2="105"
          y2="87"
          className={strokeColor}
          strokeWidth="1.5"
          strokeDasharray={strokeDasharray}
        />
        <line
          x1="35"
          y1="101"
          x2="93"
          y2="101"
          className={strokeColor}
          strokeWidth="1.5"
          strokeDasharray={strokeDasharray}
        />
        <line
          x1="35"
          y1="115"
          x2="103"
          y2="115"
          className={strokeColor}
          strokeWidth="1.5"
          strokeDasharray={strokeDasharray}
        />
        <line
          x1="35"
          y1="129"
          x2="88"
          y2="129"
          className={strokeColor}
          strokeWidth="1.5"
          strokeDasharray={strokeDasharray}
        />
      </svg>
    </div>
  );
}