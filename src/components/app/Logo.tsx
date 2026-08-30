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
    <img
      src="/logo-192.png"
      alt="TW Ventures — Acquire, Build, Manage"
      className={className}
      style={{
        display: 'block',
        width,
        height,
        objectFit: 'contain',
      }}
    />
  );
};

export default Logo;
export { Logo };
