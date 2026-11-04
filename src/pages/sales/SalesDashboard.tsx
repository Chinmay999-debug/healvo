import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  BadgeIndianRupee,
  Building2,
  Check,
  Copy,
  KeyRound,
  LogOut,
  MousePointerClick,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { Logo } from "../../components/ui/Logo";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { WhatsAppIcon, WHATSAPP_GREEN } from "../../components/ui/WhatsAppIcon";
import { ThemeToggle } from "../../components/layout/ThemeToggle";
import { PasswordField } from "../../components/auth/PasswordField";
import { ChangePasswordModal } from "../../components/settings/ChangePasswordModal";
import {
  AuthHeading,
  AuthShell,
  BackToLogin,
  ErrorText,
  fieldInputClass,
  fieldLabelClass,
} from "../../components/auth/authLayout";
import { useAuth } from "../../state/authContext";
import {
  NotSalespersonError,
  STAGE_LABEL,
  STAGE_TONE,
  getMySalesDashboard,
  type ReferralStage,
  type SalesDashboard,
} from "../../services/sales";
import { referralLink, whatsAppShareUrl } from "../../lib/salesReferral";
import { cn, getErrorMessage } from "../../lib/utils";
import { copyText } from "../../lib/copyText";
import { usePageIdentity } from "../../lib/usePageIdentity";

/**
 * /sales/dashboard — the only screen a salesperson login has. Lives outside
 * RequireAuthAndClinic (no clinic, no patient data, no doctor dashboard).
 * Everything shown comes from sales_get_my_dashboard(), which is scoped to the
 * signed-in salesperson on the server.
 */
export default function SalesDashboardPage() {
  const auth = useAuth();
  usePageIdentity("Healvo Sales", "/favicon-sales.svg");

  if (auth.loading && !auth.user) return <CenteredMessage>Loading…</CenteredMessage>;
  if (!auth.user) return <SalesLogin />;
  return <SalesHome />;
}

function SalesHome() {
  const { signOut } = useAuth();
  const [data, setData] = useState<SalesDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notSales, setNotSales] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      setData(await getMySalesDashboard());
    } catch (err) {
      if (err instanceof NotSalespersonError) setNotSales(true);
      else setError(getErrorMessage(err, "Couldn't load your dashboard."));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (notSales) {
    return (
      <CenteredMessage>
        <AlertCircle className="mx-auto text-[var(--color-amber-text)]" size={28} />
        <h1 className="mt-3 text-[17px] font-extrabold text-[var(--color-ink)]">No sales access</h1>
        <p className="mt-1.5 max-w-sm text-[13.5px] text-[var(--color-muted)]">
          This account isn&apos;t an active Healvo sales account. If you think that&apos;s wrong, contact your Healvo admin.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
          <a href="/" className="inline-flex">
            <Button variant="primary">Go to Healvo</Button>
          </a>
        </div>
      </CenteredMessage>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Logo className="text-[20px]" />
            <span className="rounded-md bg-[var(--color-teal)]/12 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-teal)]">
              Sales
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setChangingPassword(true)}
              aria-label="Change password"
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-[var(--color-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
            >
              <KeyRound size={15} />
              <span className="hidden sm:inline">Change password</span>
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-[var(--color-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {!data && !error && <DashboardSkeleton />}

        {error && !data && (
          <Card className="p-8 text-center">
            <AlertCircle className="mx-auto text-[var(--color-danger-text)]" size={26} />
            <p className="mt-3 text-[14px] font-semibold text-[var(--color-ink)]">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => void load()}>
              <RefreshCw size={14} /> Try again
            </Button>
          </Card>
        )}

        {data && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--color-ink)]">
                  Hi {data.profile.full_name.split(" ")[0]}
                </h1>
                <p className="text-[13.5px] text-[var(--color-muted)]">
                  Share your link with dentists. Every clinic that signs up through it is credited to you.
                </p>
              </div>
              <Button variant="ghost" onClick={() => void load()} disabled={refreshing} aria-label="Refresh">
                <RefreshCw size={14} className={cn(refreshing && "animate-spin")} /> Refresh
              </Button>
            </div>

            <ReferralLinkCard code={data.referral_code} active={data.link_active} />
            <MetricsGrid data={data} />
            <ReferredClinics clinics={data.clinics} />
          </>
        )}
      </main>
      <ChangePasswordModal open={changingPassword} onClose={() => setChangingPassword(false)} />
    </div>
  );
}

function ReferralLinkCard({ code, active }: { code: string | null; active: boolean }) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const link = code ? referralLink(code) : null;

  async function copy() {
    if (!link) return;
    setCopied((await copyText(link)) ? "copied" : "failed");
    window.setTimeout(() => setCopied("idle"), 2500);
  }

  const message = link
    ? `Hello Doctor, I'd like you to try Healvo, the clinic management app for dentists (patients, appointments, billing and dental charts in one place). Start your free 15-day trial here: ${link}`
    : "";

  return (
    <Card className="overflow-hidden">
      <div
        className="px-5 py-5 sm:px-6"
        style={{ background: "linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end) 70%, var(--color-surface-dark))" }}
      >
        <p className="text-[11.5px] font-bold uppercase tracking-wider text-white/75">Your referral link</p>
        {link ? (
          <>
            <p className="mt-2 break-all font-mono text-[15px] font-semibold text-white sm:text-[16px]">{link}</p>
            <p className="mt-1 text-[12.5px] text-white/75">
              Code <span className="font-bold tracking-wide text-white">{code}</span>
            </p>
          </>
        ) : (
          <p className="mt-2 text-[14px] text-white">No referral code yet. Ask your Healvo admin.</p>
        )}
      </div>

      {link && !active && (
        <div className="flex items-start gap-2 border-b border-[var(--color-border)] bg-[var(--color-amber-bg)] px-5 py-3 text-[12.5px] font-semibold text-[var(--color-amber-text)] sm:px-6">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          This link is paused by your admin. New signups through it are not being credited right now.
        </div>
      )}

      {link && (
        <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:px-6">
          <Button variant="primary" className="justify-center py-2.5 sm:min-w-[150px]" onClick={() => void copy()}>
            {copied === "copied" ? <Check size={15} /> : <Copy size={15} />}
            {copied === "copied" ? "Link copied" : copied === "failed" ? "Press and hold the link to copy" : "Copy link"}
          </Button>
          <a
            href={whatsAppShareUrl(message)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 sm:min-w-[170px]"
            style={{ backgroundColor: WHATSAPP_GREEN }}
          >
            <WhatsAppIcon size={16} /> Share on WhatsApp
          </a>
          <span role="status" aria-live="polite" className="sr-only">
            {copied === "copied" ? "Referral link copied to clipboard" : ""}
          </span>
        </div>
      )}
    </Card>
  );
}

function MetricsGrid({ data }: { data: SalesDashboard }) {
  const m = data.metrics;
  const tiles: { label: string; value: string; hint: string; icon: typeof Sparkles }[] = [
    { label: "Link visits", value: String(m.clicks), hint: `${m.unique_visitors} unique visitors`, icon: MousePointerClick },
    { label: "Doctors registered", value: String(m.registrations), hint: `${m.email_verified} verified email`, icon: UserPlus },
    { label: "Clinics set up", value: String(m.clinics_onboarded), hint: "Finished clinic onboarding", icon: Building2 },
    { label: "Active free trials", value: String(m.active_trials), hint: "15-day trial running now", icon: Sparkles },
    { label: "Paid clinics", value: String(m.paid_clinics), hint: "Currently on a paid plan", icon: BadgeIndianRupee },
    {
      label: "Conversion rate",
      value: `${m.conversion_rate}%`,
      hint: "Clinics that paid ÷ clinics set up",
      icon: TrendingUp,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {tiles.map((t) => (
        <Card key={t.label} className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-[var(--color-muted)]">{t.label}</span>
            <t.icon size={16} className="shrink-0 text-[var(--color-teal)]" />
          </div>
          <p className="mt-2 text-[26px] font-extrabold leading-none tracking-tight text-[var(--color-ink)]">{t.value}</p>
          <p className="mt-1.5 text-[11.5px] text-[var(--color-muted-soft)]">{t.hint}</p>
        </Card>
      ))}
    </div>
  );
}

const FILTERS: { key: "all" | "onboarded" | "trial" | "paid" | "pending"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Setup pending" },
  { key: "trial", label: "On trial" },
  { key: "paid", label: "Paid" },
];

function matchesFilter(stage: ReferralStage, key: (typeof FILTERS)[number]["key"]) {
  if (key === "all") return true;
  if (key === "pending") return stage === "awaiting_verification" || stage === "awaiting_onboarding";
  if (key === "trial") return stage === "trial";
  if (key === "paid") return stage === "paid";
  return true;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmt = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—");

function ReferredClinics({ clinics }: { clinics: SalesDashboard["clinics"] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clinics.filter(
      (c) =>
        matchesFilter(c.stage, filter) &&
        (!q || (c.clinic_name ?? "").toLowerCase().includes(q) || (c.doctor_name ?? "").toLowerCase().includes(q)),
    );
  }, [clinics, query, filter]);

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="text-[15px] font-extrabold text-[var(--color-ink)]">Your referrals</h2>
          <p className="text-[12px] text-[var(--color-muted)]">{clinics.length} doctors signed up with your link</p>
        </div>
        {clinics.length > 0 && (
          <label className="relative block sm:w-60">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-soft)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clinic or doctor"
              aria-label="Search referrals"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-8 pr-3 text-[13px] text-[var(--color-ink)] outline-none focus:border-[var(--color-teal)]"
            />
          </label>
        )}
      </div>

      {clinics.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pt-3 sm:px-5" role="tablist" aria-label="Filter referrals">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors",
                filter === f.key
                  ? "bg-[var(--color-ink-solid)] text-[var(--color-ink-solid-text)]"
                  : "bg-[var(--color-canvas)] text-[var(--color-muted)] hover:text-[var(--color-ink)]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {clinics.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <UserPlus className="mx-auto text-[var(--color-muted-soft)]" size={28} />
          <p className="mt-3 text-[14px] font-semibold text-[var(--color-ink)]">No referrals yet</p>
          <p className="mx-auto mt-1 max-w-xs text-[12.5px] text-[var(--color-muted)]">
            Share your link with a dentist. When they create an account it shows up here.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="px-6 py-10 text-center text-[13px] text-[var(--color-muted)]">No referrals match this filter.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] px-1 pb-1 pt-2">
          {rows.map((c, i) => (
            <li key={`${c.registered_at}-${i}`} className="flex flex-col gap-1.5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold text-[var(--color-ink)]">
                  {c.clinic_name ?? <span className="text-[var(--color-muted)]">Clinic not set up yet</span>}
                </p>
                <p className="text-[12.5px] text-[var(--color-muted)]">
                  {c.doctor_name ?? "Doctor"} · Signed up {fmt(c.registered_at)}
                  {c.clinic_created_at && <> · Set up {fmt(c.clinic_created_at)}</>}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge tone={STAGE_TONE[c.stage]}>{STAGE_LABEL[c.stage]}</Badge>
                {c.stage === "trial" && c.trial_ends_at && (
                  <span className="text-[12px] text-[var(--color-muted)]">ends {fmt(c.trial_ends_at)}</span>
                )}
                {c.plan_name && <span className="text-[12px] font-semibold text-[var(--color-muted)]">{c.plan_name}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--color-border)]" />
      <div className="h-40 animate-pulse rounded-xl bg-[var(--color-border)]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--color-border)]" />
        ))}
      </div>
    </div>
  );
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-4 text-center">
      <div>{children}</div>
    </div>
  );
}

/** Email + password only: salespeople never self-register. */
function SalesLogin() {
  const { signIn, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(getErrorMessage(err, "Sign-in failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't send the reset email. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "forgot") {
    return (
      <AuthShell>
        <BackToLogin onClick={() => setMode("login")} />
        <AuthHeading title="Reset your password" subtitle="We'll email you a link to choose a new password." />
        {sent ? (
          <p className="rounded-lg bg-[var(--color-mint-bg)] px-4 py-3 text-[13px] font-semibold text-[var(--color-mint-text)]">
            If an account exists for {email}, a reset link is on its way.
          </p>
        ) : (
          <form className="space-y-4" onSubmit={handleForgot}>
            <label className="block">
              <span className={fieldLabelClass}>Email</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={fieldInputClass} />
            </label>
            <ErrorText message={error} />
            <Button type="submit" className="w-full justify-center py-2.5" disabled={submitting || !email.trim()}>
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthHeading title="Healvo Sales" subtitle="Log in to see your referral link and results." />
      <form className="space-y-4" onSubmit={handleLogin}>
        <label className="block">
          <span className={fieldLabelClass}>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldInputClass}
          />
        </label>
        <label className="block">
          <div className="flex items-center justify-between">
            <span className={fieldLabelClass}>Password</span>
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-[12px] font-semibold text-[var(--color-teal)] hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <PasswordField
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5"
          />
        </label>
        <ErrorText message={error} />
        <Button type="submit" className="w-full justify-center py-2.5" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-[12.5px] text-[var(--color-muted)]">
        New to the sales team? Use the invitation email your Healvo admin sent you.
      </p>
    </AuthShell>
  );
}
