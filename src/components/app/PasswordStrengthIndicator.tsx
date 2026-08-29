import { CheckCircle, XCircle } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password: string;
}

const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  const checks = [
    {
      label: "At least 6 characters",
      valid: password.length >= 6,
    },
    {
      label: "Contains uppercase letter",
      valid: /[A-Z]/.test(password),
    },
    {
      label: "Contains lowercase letter", 
      valid: /[a-z]/.test(password),
    },
    {
      label: "Contains number",
      valid: /\d/.test(password),
    },
  ];

  const validCount = checks.filter(check => check.valid).length;
  const strength = validCount === 0 ? 0 : (validCount / checks.length) * 100;

  const getStrengthColor = () => {
    if (strength < 25) return 'bg-destructive/100';
    if (strength < 50) return 'bg-warning/100';
    if (strength < 75) return 'bg-yellow-500';
    return 'bg-accent';
  };

  const getStrengthText = () => {
    if (strength < 25) return 'Weak';
    if (strength < 50) return 'Fair';
    if (strength < 75) return 'Good';
    return 'Strong';
  };

  if (!password) return null;

  return (
    <div className="space-y-3 mt-3">
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Password strength</span>
          <span className={`font-medium ${
            strength < 25 ? 'text-destructive' : 
            strength < 50 ? 'text-warning' : 
            strength < 75 ? 'text-yellow-600' : 
            'text-accent'
          }`}>
            {getStrengthText()}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor()}`}
            style={{ width: `${strength}%` }}
          />
        </div>
      </div>
      
      <div className="space-y-1">
        {checks.map((check, index) => (
          <div key={index} className="flex items-center space-x-2 text-sm">
            {check.valid ? (
              <CheckCircle className="h-4 w-4 text-accent" />
            ) : (
              <XCircle className="h-4 w-4 text-gray-400" />
            )}
            <span className={check.valid ? 'text-accent' : 'text-gray-500'}>
              {check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PasswordStrengthIndicator;