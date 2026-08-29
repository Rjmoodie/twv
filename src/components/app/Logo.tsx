import React from 'react';

interface LogoProps {
  className?: string;
  width?: number | string;
  height?: number | string;
}

const Logo: React.FC<LogoProps> = ({
  className = '',
  width = 32,
  height = 32,
}) => {
  return (
    <span
      role="img"
      aria-label="TWV"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width,
        height,
        backgroundColor: '#fff',
        color: '#071a33',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: `calc(${typeof height === 'number' ? `${height}px` : String(height)} * 0.46)`,
        fontWeight: 700,
        letterSpacing: '-0.12em',
        lineHeight: 1,
        paddingRight: '0.12em',
      }}
    >
      TWV
    </span>
  );
};

export default Logo;
export { Logo };
