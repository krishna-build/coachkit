import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import Layout from "@/components/Layout";
import {
  EmailEditor,
  blocksToHtml,
  parseHtmlToBlocks,
  type EmailBlock,
  type HeaderConfig,
} from "@/components/EmailEditor";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Send,
  Clock,
  Eye,
  Users,
  Tag,
  X,
  ChevronDown,
  Sparkles,
  FileText,
  Mail,
  Monitor,
  Smartphone,
  BarChart3,
  MousePointerClick,
  AlertCircle,
  Ban,
  UserMinus,
  CalendarClock,
  TestTube2,
  FlaskConical,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Link2,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────
interface Campaign {
  id: string;
  name: string;
  subject: string;
  subject_b?: string;
  preview_text: string;
  body_html: string;
  body_blocks: EmailBlock[];
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_filter: { tags?: string[] };
  recipient_count: number;
  stats: { sent: number; opened: number; clicked: number; bounced: number; unsubscribed: number };
  template_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  subject: string;
  body_blocks: EmailBlock[];
}

// ─── Spam Score / Email Health Check ────────────────────────────
interface HealthCheck {
  label: string;
  status: "good" | "warn" | "error";
  message: string;
}

function computeEmailHealth(
  subject: string,
  previewText: string,
  blocks: EmailBlock[],
): { score: "good" | "warning"; checks: HealthCheck[] } {
  const checks: HealthCheck[] = [];

  // Subject length check
  if (!subject) {
    checks.push({ label: "Subject line", status: "error", message: "Missing subject line" });
  } else if (subject.length < 30) {
    checks.push({ label: "Subject length", status: "warn", message: `Too short (${subject.length} chars, aim for 30-60)` });
  } else if (subject.length > 60) {
    checks.push({ label: "Subject length", status: "warn", message: `Too long (${subject.length} chars, aim for 30-60)` });
  } else {
    checks.push({ label: "Subject length", status: "good", message: `Good length (${subject.length} chars)` });
  }

  // ALL CAPS check
  const capsWords = subject.split(" ").filter(w => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
  if (capsWords.length > 2) {
    checks.push({ label: "Capitalization", status: "warn", message: "Too many ALL CAPS words in subject" });
  } else {
    checks.push({ label: "Capitalization", status: "good", message: "No excessive caps" });
  }

  // Preview text check
  if (!previewText) {
    checks.push({ label: "Preview text", status: "warn", message: "No preview text set (shown in inbox)" });
  } else {
    checks.push({ label: "Preview text", status: "good", message: "Preview text is set" });
  }

  // Unsubscribe link — always good since we auto-add it
  checks.push({ label: "Unsubscribe link", status: "good", message: "Auto-added to every email ✓" });

  // Image/text ratio
  const imageBlocks = blocks.filter(b => b.type === "image").length;
  const textBlocks = blocks.filter(b => b.type === "text").length;
  if (imageBlocks > 0 && textBlocks === 0) {
    checks.push({ label: "Content ratio", status: "warn", message: "Image-only email may trigger spam filters" });
  } else if (imageBlocks > textBlocks * 2) {
    checks.push({ label: "Content ratio", status: "warn", message: "Too many images vs text" });
  } else {
    checks.push({ label: "Content ratio", status: "good", message: "Good text-to-image balance" });
  }

  const warnings = checks.filter(c => c.status === "warn" || c.status === "error").length;
  return { score: warnings > 0 ? "warning" : "good", checks };
}

// ─── Extract links from blocks for tracking UI ─────────────────
function extractLinks(blocks: EmailBlock[]): string[] {
  const links: string[] = [];
  for (const b of blocks) {
    if (b.type === "button" && b.url) links.push(b.url);
    if (b.type === "link" && b.linkUrl) links.push(b.linkUrl);
    // Detect URLs in text content
    if (b.type === "text" && b.content) {
      const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
      const matches = b.content.match(urlRegex);
      if (matches) links.push(...matches);
    }
  }
  return [...new Set(links)];
}

// ─── Component ──────────────────────────────────────────────────
export default function CampaignEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === "new";

  // ─── State ──────────────────────────────────────────────────
  const [name, setName] = useState("Untitled Campaign");
  const [subject, setSubject] = useState("");
  const [subjectB, setSubjectB] = useState("");
  const [abTestEnabled, setAbTestEnabled] = useState(false);
  const [abSplit, setAbSplit] = useState(50);
  const [previewText, setPreviewText] = useState("");
  const [blocks, setBlocks] = useState<EmailBlock[]>([
    { id: "1", type: "text", content: "Hi {{first_name}},\n\nWrite your email here..." },
  ]);
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>({
    headline: "Abundance Breakthrough: Journey with Your Coach",
    buttonText: "BOOK YOUR LIFE\nUPGRADE CALL",
    buttonUrl: "https://pages.razorpay.com/your-page-id/view",
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showTemplates, setShowTemplates] = useState(isNew);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [saved, setSaved] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(isNew ? null : id || null);

  // New feature states
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSent, setTestSent] = useState(false);
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [showRecipientPreview, setShowRecipientPreview] = useState(false);

  // ─── Queries ────────────────────────────────────────────────
  const { data: campaign, isLoading: loadingCampaign } = useQuery({
    queryKey: ["campaign", id],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from("automation_campaigns")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      // Compute live stats from email_log
      if (data && data.status === "sent") {
        const { data: logs } = await supabase
          .from("automation_email_log")
          .select("status, opened_at, clicked_at")
          .eq("campaign_id", id);
        if (logs && logs.length > 0) {
          const live = { sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
          for (const log of logs) {
            live.sent++;
            if (log.opened_at || log.status === "opened") live.opened++;
            if (log.clicked_at || log.status === "clicked") live.clicked++;
            if (log.status === "bounced") live.bounced++;
            if (log.status === "unsubscribed") live.unsubscribed++;
          }
          (data as any).stats = live;
        }
      }
      return data as Campaign;
    },
    enabled: !isNew,
  });

  const { data: templates } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data || []) as Template[];
    },
  });

  const { data: tags } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data } = await supabase
        .from("automation_tags")
        .select("*")
        .order("name");
      return data || [];
    },
  });

  const { data: recipientCount } = useQuery({
    queryKey: ["recipient-count", selectedTags],
    queryFn: async () => {
      if (selectedTags.length === 0) {
        const { count } = await supabase
          .from("automation_contacts")
          .select("id", { count: "exact", head: true });
        return count || 0;
      }
      const { count } = await supabase
        .from("automation_contacts")
        .select("id", { count: "exact", head: true })
        .overlaps("tags", selectedTags);
      return count || 0;
    },
  });

  // Contact preview query (feature 9)
  const { data: previewContacts } = useQuery({
    queryKey: ["preview-contacts", selectedTags],
    queryFn: async () => {
      let q = supabase
        .from("automation_contacts")
        .select("id, first_name, last_name, email")
        .limit(10);
      if (selectedTags.length > 0) {
        q = q.overlaps("tags", selectedTags);
      }
      const { data } = await q;
      return data || [];
    },
    enabled: showRecipientPreview,
  });

  // ─── Load campaign data ─────────────────────────────────────
  useEffect(() => {
    if (campaign) {
      setName(campaign.name || "Untitled Campaign");
      setSubject(campaign.subject || "");
      setSubjectB(campaign.subject_b || "");
      setAbTestEnabled(!!campaign.subject_b);
      setPreviewText(campaign.preview_text || "");
      if (campaign.body_blocks && Array.isArray(campaign.body_blocks) && campaign.body_blocks.length > 0) {
        setBlocks(campaign.body_blocks);
      } else if (campaign.body_html) {
        setBlocks(parseHtmlToBlocks(campaign.body_html));
      }
      setSelectedTags(campaign.recipient_filter?.tags || []);
      setCampaignId(campaign.id);
      setShowTemplates(false);
    }
  }, [campaign]);

  // ─── Mutations ──────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (opts: { status: string; scheduledAt?: string }) => {
      const payload: Record<string, any> = {
        name,
        subject,
        preview_text: previewText,
        body_html: blocksToHtml(blocks),
        body_blocks: blocks,
        status: opts.status,
        recipient_filter: { tags: selectedTags },
        recipient_count: recipientCount || 0,
        updated_at: new Date().toISOString(),
        ...(abTestEnabled && subjectB ? { subject_b: subjectB } : { subject_b: null }),
        ...(opts.status === "sent" ? { sent_at: new Date().toISOString() } : {}),
        ...(opts.status === "scheduled" && opts.scheduledAt
          ? { scheduled_at: opts.scheduledAt }
          : {}),
      };

      if (campaignId) {
        const { error } = await supabase
          .from("automation_campaigns")
          .update(payload)
          .eq("id", campaignId);
        if (error) throw error;
        return campaignId;
      } else {
        const { data, error } = await supabase
          .from("automation_campaigns")
          .insert({ ...payload, status: opts.status || "draft" })
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: (newId, opts) => {
      setCampaignId(newId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign", newId] });
      if (opts.status === "sent" || opts.status === "scheduled") {
        navigate("/campaigns");
      } else if (isNew && newId) {
        navigate(`/campaigns/${newId}`, { replace: true });
      }
    },
  });

  const applyTemplate = (template: Template) => {
    setSubject(template.subject || "");
    setBlocks(template.body_blocks || []);
    setName(template.name);
    setShowTemplates(false);
  };

  // ─── Campaign Recipients Activity ──────────────────────────
  const [recipientFilter, setRecipientFilter] = useState<"all" | "opened" | "clicked" | "not_opened">("all");
  const { data: campaignRecipients = [] } = useQuery({
    queryKey: ["campaign-recipients", id, recipientFilter],
    queryFn: async () => {
      if (isNew || !id) return [];
      const { data: logs } = await supabase
        .from("automation_email_log")
        .select("email_to, status, opened_at, clicked_at, sent_at, contYOUR_AD_ACCOUNT_IDid")
        .eq("campaign_id", id)
        .order("sent_at", { ascending: false });
      if (!logs) return [];
      // Enrich with contact names
      const contactIds = logs.map((l: any) => l.contYOUR_AD_ACCOUNT_IDid).filter(Boolean);
      const { data: contacts } = contactIds.length > 0
        ? await supabase.from("automation_contacts").select("id, first_name, last_name").in("id", contactIds)
        : { data: [] };
      const nameMap: Record<string, string> = {};
      for (const c of contacts || []) {
        nameMap[c.id] = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown";
      }
      return logs.map((l: any) => ({
        ...l,
        name: nameMap[l.contYOUR_AD_ACCOUNT_IDid] || l.email_to?.split("@")[0] || "Unknown",
        isOpened: !!(l.opened_at || l.status === "opened" || l.status === "clicked"),
        isClicked: !!(l.clicked_at || l.status === "clicked"),
      }));
    },
    enabled: !isNew && !!id,
  });

  const filteredRecipients = campaignRecipients.filter((r: any) => {
    if (recipientFilter === "opened") return r.isOpened;
    if (recipientFilter === "clicked") return r.isClicked;
    if (recipientFilter === "not_opened") return !r.isOpened;
    return true;
  });

  // ─── Email Health / Spam Score ──────────────────────────────
  const emailHealth = useMemo(
    () => computeEmailHealth(subject, previewText, blocks),
    [subject, previewText, blocks],
  );

  // ─── Link tracking data ────────────────────────────────────
  const trackedLinks = useMemo(() => extractLinks(blocks), [blocks]);

  // ─── Analytics view for sent campaigns ──────────────────────
  const isSent = campaign?.status === "sent";
  const stats = campaign?.stats || { sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };

  const chartData = useMemo(() => {
    if (!isSent) return [];
    return [
      { name: "Sent", value: stats.sent, fill: "#FFB433" },
      { name: "Opened", value: stats.opened, fill: "#10b981" },
      { name: "Clicked", value: stats.clicked, fill: "#3B82F6" },
      { name: "Bounced", value: stats.bounced, fill: "#ef4444" },
      { name: "Unsub", value: stats.unsubscribed, fill: "#8b5cf6" },
    ];
  }, [isSent, stats]);

  const statCards = useMemo(() => {
    if (!isSent) return [];
    const pct = (n: number) => stats.sent > 0 ? `${Math.round((n / stats.sent) * 100)}%` : "0%";
    return [
      { label: "Sent", value: stats.sent, icon: Send, gradient: "from-[#FFB433]/20 to-[#FFB433]/5", iconGradient: "from-[#FFB433] to-[#e6a02e]" },
      { label: "Opened", value: `${stats.opened} (${pct(stats.opened)})`, icon: Eye, gradient: "from-emerald-500/20 to-emerald-500/5", iconGradient: "from-emerald-500 to-emerald-600" },
      { label: "Clicked", value: `${stats.clicked} (${pct(stats.clicked)})`, icon: MousePointerClick, gradient: "from-blue-500/20 to-blue-500/5", iconGradient: "from-blue-500 to-blue-600" },
      { label: "Bounced", value: `${stats.bounced} (${pct(stats.bounced)})`, icon: AlertCircle, gradient: "from-red-500/20 to-red-500/5", iconGradient: "from-red-500 to-red-600" },
      { label: "Unsubscribed", value: `${stats.unsubscribed} (${pct(stats.unsubscribed)})`, icon: UserMinus, gradient: "from-violet-500/20 to-violet-500/5", iconGradient: "from-violet-500 to-violet-600" },
    ];
  }, [isSent, stats]);

  // ─── Render ─────────────────────────────────────────────────
  if (!isNew && loadingCampaign) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/campaigns")}
              className="w-10 h-10 rounded-xl bg-surface border border-border/50 flex items-center justify-center hover:bg-surface-hover transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-foreground/70" />
            </motion.button>
            <div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                readOnly={isSent}
                className="text-xl font-bold text-foreground bg-transparent border-none focus:outline-none focus:ring-0 w-full max-w-md placeholder:text-muted-foreground"
                placeholder="Campaign name..."
              />
              <p className="text-xs text-muted-foreground mt-0.5">
                {isSent
                  ? `Sent on ${new Date(campaign!.sent_at!).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
                  : isNew
                  ? "New campaign"
                  : "Draft"}
              </p>
            </div>
          </div>

          {!isSent && (
            <div className="flex items-center gap-2 flex-wrap">
              <AnimatePresence>
                {saved && (
                  <motion.span
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-emerald-400 font-medium"
                  >
                    ✓ Saved
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Send Test Button (Feature 1) */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowTestModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/30 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
              >
                <Mail className="w-4 h-4" /> Send Test
              </motion.button>

              {/* Save Draft Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => saveMutation.mutate({ status: "draft" })}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border/50 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Save Draft
              </motion.button>

              {/* Send / Schedule Split Button (Feature 2) */}
              <div className="relative">
                <div className="flex">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => saveMutation.mutate({ status: "sent" })}
                    disabled={saveMutation.isPending || !subject}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-l-xl bg-gradient-to-r from-primary to-gold-dark text-black text-sm font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow disabled:opacity-50 disabled:shadow-none"
                  >
                    <Send className="w-4 h-4" /> Send Now
                  </motion.button>
                  <button
                    onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
                    disabled={saveMutation.isPending || !subject}
                    className="px-2 py-2.5 rounded-r-xl bg-gradient-to-r from-gold-dark to-[#e6a02e] text-black border-l border-black/10 hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${showScheduleDropdown ? "rotate-180" : ""}`} />
                  </button>
                </div>
                <AnimatePresence>
                  {showScheduleDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute right-0 top-12 z-30 bg-card border border-border/50 rounded-xl shadow-xl overflow-hidden min-w-[220px]"
                    >
                      <button
                        onClick={() => {
                          setShowScheduleDropdown(false);
                          setShowSchedulePicker(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-foreground hover:bg-surface-hover transition-colors"
                      >
                        <CalendarClock className="w-4 h-4 text-primary" />
                        Schedule for Later
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* Schedule Date/Time Picker Modal (Feature 2) */}
        <AnimatePresence>
          {showSchedulePicker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowSchedulePicker(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card rounded-2xl border border-border/50 p-6 max-w-sm w-full shadow-2xl"
              >
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CalendarClock className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground text-center mb-2">
                  Schedule Campaign
                </h3>
                <p className="text-sm text-muted-foreground text-center mb-5">
                  Choose when to send this campaign
                </p>
                <div className="mb-5">
                  <label className="text-xs font-semibold text-muted-foreground block mb-2">
                    Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full h-11 px-3 rounded-xl bg-surface border border-border/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all [color-scheme:dark]"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSchedulePicker(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-surface border border-border/50 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (scheduleDate) {
                        saveMutation.mutate({
                          status: "scheduled",
                          scheduledAt: new Date(scheduleDate).toISOString(),
                        });
                        setShowSchedulePicker(false);
                      }
                    }}
                    disabled={!scheduleDate}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-gold-dark text-black text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    Schedule
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Send Test Email Modal (Feature 1) */}
        <AnimatePresence>
          {showTestModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => { setShowTestModal(false); setTestSent(false); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card rounded-2xl border border-border/50 p-6 max-w-md w-full shadow-2xl"
              >
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground text-center mb-2">
                  Send Test Email
                </h3>
                <p className="text-sm text-muted-foreground text-center mb-5">
                  Preview how your email will look in an inbox
                </p>

                {!testSent ? (
                  <>
                    <div className="mb-4">
                      <label className="text-xs font-semibold text-muted-foreground block mb-2">
                        Send to email address
                      </label>
                      <input
                        type="email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full h-11 px-3 rounded-xl bg-surface border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
                      />
                    </div>

                    {/* Quick Preview */}
                    <div className="mb-5 bg-surface rounded-xl border border-border/50 p-3">
                      <p className="text-[10px] text-muted-foreground mb-1">Subject</p>
                      <p className="text-sm text-foreground font-medium truncate">{subject || "No subject"}</p>
                      {previewText && (
                        <>
                          <p className="text-[10px] text-muted-foreground mt-2 mb-1">Preview text</p>
                          <p className="text-xs text-muted-foreground truncate">{previewText}</p>
                        </>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => { setShowTestModal(false); setTestSent(false); }}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-surface border border-border/50 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          if (testEmail) {
                            setTestSent(true);
                            setTimeout(() => {
                              setShowTestModal(false);
                              setTestSent(false);
                            }, 2500);
                          }
                        }}
                        disabled={!testEmail}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-gold-dark text-black text-sm font-semibold transition-all disabled:opacity-50"
                      >
                        Send Test
                      </button>
                    </div>
                  </>
                ) : (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-4"
                  >
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Test email would be sent to
                    </p>
                    <p className="text-primary font-semibold mt-1">{testEmail}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      (Actual sending comes with Brevo integration)
                    </p>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analytics View (for sent campaigns) */}
        {isSent && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {statCards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`bg-gradient-to-br ${card.gradient} rounded-2xl border border-border/50 p-4`}
                  >
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.iconGradient} flex items-center justify-center mb-3`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-xl font-bold text-foreground">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Chart */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card rounded-2xl border border-border/50 p-5"
            >
              <h3 className="text-sm font-semibold text-foreground mb-4">Campaign Performance</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "12px",
                        fontSize: "12px",
                        color: "var(--color-foreground)",
                      }}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Recipient Activity */}
            {campaignRecipients.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="bg-card rounded-2xl border border-border/50 p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Recipient Activity</h3>
                    <span className="text-xs text-muted-foreground">({filteredRecipients.length})</span>
                  </div>
                </div>
                {/* Filter tabs */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  {([
                    { key: "all", label: "All" },
                    { key: "opened", label: `Opened (${campaignRecipients.filter((r: any) => r.isOpened).length})` },
                    { key: "clicked", label: `Clicked (${campaignRecipients.filter((r: any) => r.isClicked).length})` },
                    { key: "not_opened", label: `Not Opened (${campaignRecipients.filter((r: any) => !r.isOpened).length})` },
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setRecipientFilter(tab.key)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
                        recipientFilter === tab.key
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "bg-surface text-muted-foreground border-border/50 hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {/* Recipient list */}
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {filteredRecipients.slice(0, 50).map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-surface/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          r.isClicked ? "bg-blue-500/15 text-blue-400" :
                          r.isOpened ? "bg-emerald-500/15 text-emerald-400" :
                          "bg-muted/30 text-muted-foreground"
                        }`}>
                          {(r.name || "?")[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{r.email_to}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {r.isClicked && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">Clicked</span>
                        )}
                        {r.isOpened && !r.isClicked && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Opened</span>
                        )}
                        {!r.isOpened && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted/30 text-muted-foreground border border-border/50">Not opened</span>
                        )}
                        {r.opened_at && (
                          <span className="text-[10px] text-muted-foreground hidden sm:block">
                            {new Date(r.opened_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredRecipients.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center py-2">+{filteredRecipients.length - 50} more</p>
                  )}
                  {filteredRecipients.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No recipients in this filter</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Link Click Tracking (Feature 12) */}
            {trackedLinks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-card rounded-2xl border border-border/50 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Link2 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Links Clicked</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
                        <th className="pb-2 font-medium">Link URL</th>
                        <th className="pb-2 font-medium text-right">Clicks</th>
                        <th className="pb-2 font-medium text-right">% of Opens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trackedLinks.map((link, i) => (
                        <tr key={i} className="border-b border-border/30 last:border-0">
                          <td className="py-2.5 pr-4">
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline truncate block max-w-[300px] text-xs"
                            >
                              {link}
                            </a>
                          </td>
                          <td className="py-2.5 text-right text-foreground font-medium">0</td>
                          <td className="py-2.5 text-right text-muted-foreground">0%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-muted-foreground mt-3 text-center">
                    Click tracking will be active when email service is integrated
                  </p>
                </div>
              </motion.div>
            )}

            {/* Email Preview */}
            <div className="bg-card rounded-2xl border border-border/50 p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Email Preview</h3>
              <div className="max-w-[680px] mx-auto">
                <EmailEditor
                  blocks={blocks}
                  onChange={() => {}}
                  subject={subject}
                  onSubjectChange={() => {}}
                  readOnly
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Editor View (for drafts and new) */}
        {!isSent && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            {/* Main Editor Area */}
            <div className="space-y-4">
              {/* Template Picker */}
              <AnimatePresence>
                {showTemplates && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-card rounded-2xl border border-border/50 p-5 overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Start from a template</h3>
                      </div>
                      <button
                        onClick={() => setShowTemplates(false)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Start blank
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(templates || []).map((t) => (
                        <motion.button
                          key={t.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => applyTemplate(t)}
                          className="bg-surface rounded-xl border border-border/50 p-4 text-left hover:border-primary/30 transition-all group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {t.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {t.description}
                          </p>
                          <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 capitalize">
                            {t.category}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Preview Mode Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewMode("desktop")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    previewMode === "desktop"
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" /> Desktop
                </button>
                <button
                  onClick={() => setPreviewMode("mobile")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    previewMode === "mobile"
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> Mobile
                </button>
                {!showTemplates && isNew && (
                  <button
                    onClick={() => setShowTemplates(true)}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Templates
                  </button>
                )}
              </div>

              {/* Email Editor */}
              <div className={`${previewMode === "mobile" ? "max-w-[375px] mx-auto" : ""}`}>
                <EmailEditor
                  blocks={blocks}
                  onChange={setBlocks}
                  subject={subject}
                  onSubjectChange={setSubject}
                  headerConfig={headerConfig}
                  onHeaderChange={setHeaderConfig}
                />
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-4">
              {/* Subject Line + A/B Testing (Features 6) */}
              <div className="bg-card rounded-2xl border border-border/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 inline mr-1.5" />
                    Subject Line
                  </label>
                  {/* A/B Test Toggle */}
                  <button
                    onClick={() => setAbTestEnabled(!abTestEnabled)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                      abTestEnabled
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                    }`}
                  >
                    <FlaskConical className="w-3 h-3" />
                    A/B Test
                  </button>
                </div>

                {abTestEnabled ? (
                  <div className="space-y-3">
                    {/* Subject A */}
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-5 h-5 rounded-md bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">A</span>
                        <span className="text-[10px] text-muted-foreground font-medium">Subject A</span>
                      </div>
                      <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-surface border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
                        placeholder="Subject line A..."
                      />
                    </div>
                    {/* Subject B */}
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-5 h-5 rounded-md bg-blue-500/15 text-blue-400 text-[10px] font-bold flex items-center justify-center">B</span>
                        <span className="text-[10px] text-muted-foreground font-medium">Subject B</span>
                      </div>
                      <input
                        value={subjectB}
                        onChange={(e) => setSubjectB(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-surface border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/50 transition-all"
                        placeholder="Subject line B..."
                      />
                    </div>
                    {/* Split Percentage */}
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium block mb-1.5">
                        Traffic Split
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all"
                            style={{ width: `${abSplit}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-primary">{abSplit}%</span>
                        <span className="text-[10px] text-muted-foreground">/</span>
                        <span className="text-[10px] font-bold text-blue-400">{100 - abSplit}%</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        step={10}
                        value={abSplit}
                        onChange={(e) => setAbSplit(Number(e.target.value))}
                        className="w-full h-1 mt-1 accent-[#FFB433]"
                      />
                    </div>
                  </div>
                ) : (
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-surface border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
                    placeholder="Email subject..."
                  />
                )}

                <label className="text-xs font-semibold text-muted-foreground block mb-2 mt-4">
                  Preview Text
                </label>
                <input
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
                  placeholder="Preview text shown in inbox..."
                />
              </div>

              {/* Email Health / Spam Score (Feature 11) */}
              <div className="bg-card rounded-2xl border border-border/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground">Email Health</span>
                  <span
                    className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      emailHealth.score === "good"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {emailHealth.score === "good"
                      ? "Good ✓"
                      : `${emailHealth.checks.filter(c => c.status !== "good").length} warning${emailHealth.checks.filter(c => c.status !== "good").length > 1 ? "s" : ""} ⚠️`}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {emailHealth.checks.map((check, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      {check.status === "good" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : check.status === "warn" ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={check.status === "good" ? "text-muted-foreground" : "text-foreground"}>
                        {check.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recipient Selector */}
              <div className="bg-card rounded-2xl border border-border/50 p-4">
                <label className="text-xs font-semibold text-muted-foreground block mb-2">
                  <Users className="w-3.5 h-3.5 inline mr-1.5" />
                  Recipients
                </label>

                {/* Selected tags as chips */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedTags.map((tagName) => {
                    const tag = (tags || []).find((t: any) => t.name === tagName);
                    return (
                      <span
                        key={tagName}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: tag?.color || "#FFB433" }}
                        />
                        {tagName}
                        <button
                          onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tagName))}
                          className="hover:text-foreground transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>

                {/* Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowTagDropdown(!showTagDropdown)}
                    className="w-full h-10 px-3 rounded-xl bg-surface border border-border/50 text-sm text-left text-muted-foreground flex items-center justify-between hover:border-primary/30 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      {selectedTags.length === 0 ? "All contacts" : "Add tag filter..."}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTagDropdown ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {showTagDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute z-20 top-12 left-0 right-0 bg-card border border-border/50 rounded-xl shadow-xl overflow-hidden"
                      >
                        {(tags || []).map((tag: any) => {
                          const isSelected = selectedTags.includes(tag.name);
                          return (
                            <button
                              key={tag.id}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedTags((prev) => prev.filter((t) => t !== tag.name));
                                } else {
                                  setSelectedTags((prev) => [...prev, tag.name]);
                                }
                              }}
                              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
                                isSelected
                                  ? "bg-primary/10 text-primary"
                                  : "text-foreground hover:bg-surface-hover"
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: tag.color || "#6366f1" }}
                              />
                              <span className="flex-1">{tag.name}</span>
                              {isSelected && <span className="text-primary text-xs">✓</span>}
                            </button>
                          );
                        })}
                        {selectedTags.length > 0 && (
                          <button
                            onClick={() => setSelectedTags([])}
                            className="w-full px-4 py-2.5 text-xs text-danger hover:bg-danger/5 border-t border-border/50 transition-colors"
                          >
                            Clear all filters
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Recipient count */}
                <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    {recipientCount ?? "—"} recipients
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {selectedTags.length === 0
                    ? "Will send to all contacts"
                    : `Contacts with tags: ${selectedTags.join(", ")}`}
                </p>

                {/* Preview Recipients (Feature 9) */}
                <button
                  onClick={() => setShowRecipientPreview(!showRecipientPreview)}
                  className="mt-2 flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                >
                  <Eye className="w-3 h-3" />
                  {showRecipientPreview ? "Hide preview" : "Preview recipients"}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showRecipientPreview ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {showRecipientPreview && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 bg-surface rounded-xl border border-border/30 p-2.5 space-y-1.5 max-h-[200px] overflow-y-auto">
                        {previewContacts && previewContacts.length > 0 ? (
                          <>
                            {previewContacts.map((c: any) => (
                              <div key={c.id} className="flex items-center gap-2 text-[11px]">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[9px] font-bold flex-shrink-0">
                                  {(c.first_name || "?")[0]}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-foreground font-medium truncate">
                                    {c.first_name} {c.last_name || ""}
                                  </p>
                                  <p className="text-muted-foreground truncate">{c.email}</p>
                                </div>
                              </div>
                            ))}
                            {(recipientCount || 0) > 10 && (
                              <p className="text-[10px] text-muted-foreground text-center pt-1">
                                and {(recipientCount || 0) - 10} more...
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-[10px] text-muted-foreground text-center py-2">
                            No contacts found
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Quick Stats (for existing drafts) */}
              {!isNew && campaign && (
                <div className="bg-card rounded-2xl border border-border/50 p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">Campaign Info</p>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className="capitalize font-medium text-foreground">{campaign.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Created</span>
                      <span className="font-medium text-foreground">
                        {new Date(campaign.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    {campaign.updated_at && (
                      <div className="flex justify-between">
                        <span>Last edited</span>
                        <span className="font-medium text-foreground">
                          {new Date(campaign.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
