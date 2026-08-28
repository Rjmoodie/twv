import React from 'react';

interface SomaTechLogoProps {
  className?: string;
  width?: number | string;
  height?: number | string;
}

const SomaTechLogo: React.FC<SomaTechLogoProps> = ({
  className = '',
  width = 32,
  height = 32,
}) => {
  return (
    <img
      src="/logo.png"
      alt="SomaTech"
      width={width}
      height={height}
      className={className}
      style={{ objectFit: 'contain', display: 'block' }}
    />
  );
};

export default SomaTechLogo;
export { SomaTechLogo };
