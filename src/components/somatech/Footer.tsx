import React from "react";
import { DiscordService } from "@/services/discord";

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2518-.1912.3718-.2894a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.0978.2462.195.372.2894a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.019 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189Z"/>
  </svg>
);

interface FooterProps {
  onPrivacyClick: () => void;
  onTermsClick:   () => void;
}

const Footer = ({ onPrivacyClick, onTermsClick }: FooterProps) => (
  <footer className="mt-8 border-t border-border/40 px-4 py-4">
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-muted-foreground">

      {/* Left — brand + copyright */}
      <span className="font-medium text-foreground/60">
        SomaTech © {new Date().getFullYear()}
      </span>

      {/* Right — links */}
      <div className="flex items-center gap-4">
        <button onClick={onPrivacyClick} className="hover:text-foreground transition-colors">
          Privacy
        </button>
        <button onClick={onTermsClick} className="hover:text-foreground transition-colors">
          Terms
        </button>
        <a href="mailto:support@somatech.pro" className="hover:text-foreground transition-colors">
          Contact
        </a>
        <a
          href={DiscordService.getDiscordInviteLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          aria-label="Join the SomaTech Discord community"
        >
          <DiscordIcon className="h-3.5 w-3.5" />
          Discord
        </a>
      </div>

    </div>
  </footer>
);

export default Footer;
