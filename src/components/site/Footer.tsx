import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-surface-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-primary-foreground">
                <Zap className="h-4 w-4" />
              </span>
              <span className="text-lg tracking-tight">DailyResume</span>
            </div>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              Automated resume refresh for job seekers. Stay active, get noticed by recruiters — every single day.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            <div>
              <div className="mb-3 font-medium text-foreground">Product</div>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="/#features" className="hover:text-foreground">Features</a></li>
                <li><a href="/#platforms" className="hover:text-foreground">Platforms</a></li>
                <li><Link to="/pricing" className="hover:text-foreground">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <div className="mb-3 font-medium text-foreground">Company</div>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="/#faq" className="hover:text-foreground">FAQ</a></li>
                <li><a href="mailto:hello@dailyresume.app" className="hover:text-foreground">Contact</a></li>
              </ul>
            </div>
            <div>
              <div className="mb-3 font-medium text-foreground">Legal</div>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Privacy</a></li>
                <li><a href="#" className="hover:text-foreground">Terms</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-border/60 pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} DailyResume. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
