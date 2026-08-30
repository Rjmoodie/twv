import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthProvider";
import { useNavigation } from "@/contexts/NavigationContext";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell, CheckCheck, CheckCircle2, AlertTriangle, AlertCircle,
  Info, DollarSign, BarChart3, RefreshCw, Zap, Shield,
  CreditCard, Activity, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  action_url: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeConfig(type: string): { icon: React.ReactNode; bg: string } {
  switch (type) {
    case "success":
    case "analysis_complete":
    case "sync":
      return { icon: <CheckCircle2 className="h-4 w-4" />, bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
    case "warning":
    case "watchlist_alert":
      return { icon: <AlertTriangle className="h-4 w-4" />, bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
    case "error":
    case "security":
      return { icon: <Shield className="h-4 w-4" />, bg: "bg-destructive/10 text-destructive" };
    case "price_target":
    case "billing":
      return { icon: <CreditCard className="h-4 w-4" />, bg: "bg-violet-500/10 text-violet-600 dark:text-violet-400" };
    case "weekly_summary":
      return { icon: <BarChart3 className="h-4 w-4" />, bg: "bg-primary/10 text-primary" };
    case "coach":
      return { icon: <Zap className="h-4 w-4" />, bg: "bg-violet-500/10 text-violet-600 dark:text-violet-400" };
    case "plaid":
    case "account":
      return { icon: <Link2 className="h-4 w-4" />, bg: "bg-sky-500/10 text-sky-600 dark:text-sky-400" };
    case "journey":
      return { icon: <Activity className="h-4 w-4" />, bg: "bg-teal-500/10 text-teal-600 dark:text-teal-400" };
    case "system":
      return { icon: <DollarSign className="h-4 w-4" />, bg: "bg-primary/10 text-primary" };
    default:
      return { icon: <Info className="h-4 w-4" />, bg: "bg-primary/10 text-primary" };
  }
}

function relativeTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <div className="h-8 w-8 rounded-xl bg-muted animate-pulse shrink-0" />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="h-3 bg-muted rounded-lg animate-pulse w-3/4" />
        <div className="h-2.5 bg-muted rounded-lg animate-pulse w-1/2" />
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const NotificationBell = ({ className }: { className?: string }) => {
  const { user } = useAuth();
  const { navigateToModule } = useNavigation();
  const navigate = useNavigate();

  // The dispatcher stores an action_url on every notification, but nothing was
  // reading it -- clicking only marked the row read, so the deep link the email
  // and the bell share was dead in the bell. Most are `/?module=x`, which has
  // to go through navigateToModule so Workspace's history and scroll handling
  // stay correct; anything else is a real route and goes to the router.
  const openNotification = (actionUrl: string | null) => {
    setOpen(false);
    if (!actionUrl) return;
    try {
      const target = new URL(actionUrl, window.location.origin);
      if (target.origin !== window.location.origin) return;
      const moduleParam = target.searchParams.get('module');
      if (moduleParam) navigateToModule(moduleParam);
      else navigate(`${target.pathname}${target.search}`);
    } catch {
      /* a malformed action_url should not break the menu */
    }
  };
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      const { data, error: err } = await supabase
        .from("notifications")
        .select("id, title, message, type, read, created_at, action_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (err) throw err;
      const list = (data ?? []) as Notification[];
      setItems(list);
      setUnread(list.filter((n) => !n.read).length);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) void load(); else { setItems([]); setUnread(0); } }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`notification-bell:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("read", false);
    setItems((p) => p.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const markOne = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("id", id);
    setItems((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((c) => Math.max(0, c - 1));
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {/* ── Trigger — 44 × 44 touch target ─────────────────────────────────── */}
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
          className={cn(
            "relative flex h-11 w-11 items-center justify-center rounded-full",
            "text-foreground/80 transition-colors",
            "hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            className
          )}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background"
            />
          )}
        </button>
      </DropdownMenuTrigger>

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={12}
        collisionPadding={16}
        className={cn(
          // z above header (z-40) and any overlays
          "z-[80]",
          // responsive width: fills mobile minus 2rem margin, capped on desktop
          "w-[calc(100vw-2rem)] max-w-[420px] sm:w-[380px]",
          // shape
          "overflow-hidden rounded-2xl border border-border/70 bg-popover p-0",
          // shadow
          "shadow-xl shadow-slate-900/10",
          // animation
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-2"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Notifications</h2>
              {unread > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary">
                  {unread}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Account, coach, and sync alerts
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* Body — scrollable, max height adapts to viewport */}
        <div className="max-h-[min(70dvh,480px)] overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="divide-y divide-border/30">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <p className="text-sm font-semibold">Couldn't load notifications</p>
              <p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p>
              <button
                onClick={load}
                className="mt-3 flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-semibold">All caught up</p>
              <p className="mt-1 max-w-[230px] text-xs leading-5 text-muted-foreground">
                New alerts, sync updates, and coach reminders will appear here.
              </p>
            </div>
          ) : (
            /* Notification list */
            <div className="divide-y divide-border/30">
              {items.map((n) => {
                const { icon, bg } = typeConfig(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={() => { if (!n.read) markOne(n.id); openNotification(n.action_url ?? null); }}
                    className={cn(
                      "group w-full flex items-start gap-3 px-4 py-3.5 text-left",
                      "transition-colors hover:bg-muted/50 min-h-[56px]",
                      !n.read && "bg-primary/[0.03]"
                    )}
                  >
                    {/* Icon chip */}
                    <div className={cn(
                      "mt-0.5 shrink-0 h-8 w-8 rounded-xl flex items-center justify-center",
                      n.read ? "bg-muted/60 text-muted-foreground" : bg
                    )}>
                      {icon}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn(
                          "text-xs font-medium leading-tight truncate",
                          n.read ? "text-muted-foreground" : "text-foreground"
                        )}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
                          {relativeTime(n.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
                      <div className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-border/50 px-4 py-2.5">
            <button
              onClick={() => { setOpen(false); navigate("/?module=account&tab=notifications"); }}
              className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors py-0.5"
            >
              View all notifications →
            </button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
