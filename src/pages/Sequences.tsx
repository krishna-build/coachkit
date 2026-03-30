import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import Layout from "@/components/Layout";
import { useToast } from "@/components/Toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Plus, Play, Pause, Trash2, Eye, Pencil,
  Users, CheckCircle, Mail, Clock, MoreVertical, X,
  ArrowRight, TrendingUp, BarChart2, ChevronRight, GitBranch, MousePointerClick,
  RefreshCw, Send, UserX, Calendar, Filter, ArrowDown, ArrowUp,
  DollarSign, Activity, Timer, Target, ChevronDown, ExternalLink
} from "lucide-react";
import { EmailEditor, parseHtmlToBlocks, blocksToHtml, type EmailBlock, type HeaderConfig } from "@/components/EmailEditor";

// ─── Types ─────────────────────────────────────────────────────
interface StepAction {
  action: "continue" | "skip_to" | "stop" | "add_tag" | "send_email";
  step_index?: number;
  tag?: string;
  email_subject?: string;
}

interface ConditionConfig {
  field: "opened_previous" | "clicked_previous" | "has_tag" | "paid_299" | "call_booked";
  true_action: "continue" | "skip_to" | "stop" | "add_tag";
  false_action: "continue" | "skip_to" | "stop" | "add_tag";
  true_tag?: string;
  false_tag?: string;
}

interface CustomerJourney {
  contYOUR_AD_ACCOUNT_IDid: string;
  name: string;
  email: string;
  events: {
    type: "added" | "email_sent" | "email_opened" | "email_clicked" | "paid";
    date: string;
    stepNumber?: number;
    subject?: string;
    amount?: number;
  }[];
}

const CONDITION_FIELDS: { value: ConditionConfig["field"]; label: string }[] = [
  { value: "opened_previous", label: "Opened previous email" },
  { value: "clicked_previous", label: "Clicked link in previous email" },
  { value: "has_tag", label: "Has tag" },
  { value: "paid_299", label: "Paid ₹299" },
  { value: "call_booked", label: "Booked a call" },
];

const ACTION_OPTIONS: { value: ConditionConfig["true_action"]; label: string }[] = [
  { value: "continue", label: "Continue to next step" },
  { value: "add_tag", label: "Add tag" },
  { value: "skip_to", label: "Skip next email" },
  { value: "stop", label: "Stop sequence" },
];

const DATE_FILTERS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
];

// ─── Utility Functions ─────────────────────────────────────────
const formatDateIST = (date: string | null, format: "short" | "long" | "time" = "short"): string => {
  if (!date) return "—";
  const d = new Date(date);
  if (format === "time") {
    return d.toLocaleString("en-IN", { 
      timeZone: "Asia/Kolkata", 
      hour: "2-digit", 
      minute: "2-digit", 
      hour12: true 
    });
  }
  if (format === "long") {
    return d.toLocaleString("en-IN", { 
      timeZone: "Asia/Kolkata", 
      day: "numeric", 
      month: "short", 
      year: "numeric",
      hour: "2-digit", 
      minute: "2-digit", 
      hour12: true 
    });
  }
  return d.toLocaleString("en-IN", { 
    timeZone: "Asia/Kolkata", 
    day: "numeric", 
    month: "short", 
    hour: "2-digit", 
    minute: "2-digit", 
    hour12: true 
  });
};

const getDateRange = (filter: string): { start: Date | null; end: Date | null } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (filter) {
    case "today":
      return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
    case "yesterday":
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      return { start: yesterday, end: today };
    case "last_7_days":
      const week = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: week, end: new Date() };
    case "last_30_days":
      const month = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start: month, end: new Date() };
    default:
      return { start: null, end: null };
  }
};

// ─── Preview Modal ─────────────────────────────────────────────
function PreviewModal({ step, onClose }: { step: any; onClose: () => void }) {
  const blocks = parseHtmlToBlocks(step.email_body || "");
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-auto" onClick={onClose}>
      <div className="max-w-[680px] w-full my-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-white">Email Preview</p>
            <p className="text-xs text-white/50">{step.email_subject?.replace(/\{\{first_name\}\}/g, "John")}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <EmailEditor blocks={blocks} onChange={() => {}} subject={step.email_subject || ""} onSubjectChange={() => {}} readOnly />
      </div>
    </div>
  );
}

// ─── Edit Modal ────────────────────────────────────────────────
function EditModal({ step, onClose, onSave }: { step: any; onClose: () => void; onSave: (subject: string, body: string) => void }) {
  const [blocks, setBlocks] = useState<EmailBlock[]>(parseHtmlToBlocks(step.email_body || ""));
  const [subject, setSubject] = useState(step.email_subject || "");
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>({
    headline: "Abundance Breakthrough: Journey with Your Coach",
    buttonText: "BOOK YOUR LIFE\nUPGRADE CALL",
    buttonUrl: "https://pages.razorpay.com/your-page-id/view",
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-start justify-center p-4 overflow-auto">
      <div className="max-w-[800px] w-full my-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-base font-bold text-white">Edit Email</p>
            <p className="text-xs text-white/40">Click any block to edit</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20 transition-colors">Cancel</button>
            <button onClick={() => onSave(subject, blocksToHtml(blocks))} className="px-5 py-2 rounded-xl bg-primary text-black text-sm font-bold hover:bg-primary/90 transition-colors">Save changes</button>
          </div>
        </div>
        <EmailEditor blocks={blocks} onChange={setBlocks} subject={subject} onSubjectChange={setSubject} headerConfig={headerConfig} onHeaderChange={setHeaderConfig} />
      </div>
    </div>
  );
}

// ─── Add Step Modal ────────────────────────────────────────────
function AddStepModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (subject: string, body: string, waitHours: number) => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [waitDays, setWaitDays] = useState(1);

  const QUICK_SUBJECTS = [
    "Welcome {{first_name}}! Here's what happens next 🙏",
    "A quick story about someone just like you...",
    "{{first_name}}, your spot is still available ⏰",
    "The real reason talented people stay stuck",
    "{{first_name}}, last chance — spots filling up",
    "Just checking in 👋",
  ];

  const DAY_OPTIONS = [
    { value: 0, label: "Immediately" },
    { value: 1, label: "+1 day" },
    { value: 2, label: "+2 days" },
    { value: 3, label: "+3 days" },
    { value: 5, label: "+5 days" },
    { value: 7, label: "+7 days" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm font-bold text-foreground">Add Email Step</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Send delay</p>
            <div className="grid grid-cols-3 gap-1.5">
              {DAY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setWaitDays(opt.value)}
                  className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                    waitDays === opt.value
                      ? "bg-primary text-black shadow-md shadow-primary/20"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Subject line</p>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Your subject line..."
              autoFocus
              className="w-full h-10 px-3.5 rounded-xl bg-background border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>

          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Quick ideas</p>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {QUICK_SUBJECTS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setSubject(s)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                    subject === s
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-transparent"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-muted/50 text-muted-foreground text-sm font-semibold hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            disabled={!subject}
            onClick={() => onAdd(subject, body || `<p>Hi {{first_name}},</p>\n<p>Write your email here...</p>`, waitDays * 24)}
            className="flex-1 py-2.5 rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-30 hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5"
          >
            Add Step <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Customer Journey Modal ────────────────────────────────────
function CustomerJourneyModal({ journey, onClose }: { journey: CustomerJourney; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <p className="text-base font-bold text-foreground">{journey.name}</p>
            <p className="text-xs text-muted-foreground">{journey.email}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Customer Journey</p>
          <div className="space-y-4">
            {journey.events.map((event, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    event.type === "added" ? "bg-blue-500/10 text-blue-400" :
                    event.type === "email_sent" ? "bg-purple-500/10 text-purple-400" :
                    event.type === "email_opened" ? "bg-emerald-500/10 text-emerald-400" :
                    event.type === "email_clicked" ? "bg-orange-500/10 text-orange-400" :
                    "bg-green-500/10 text-green-400"
                  }`}>
                    {event.type === "added" ? <Users className="w-4 h-4" /> :
                     event.type === "email_sent" ? <Send className="w-4 h-4" /> :
                     event.type === "email_opened" ? <Eye className="w-4 h-4" /> :
                     event.type === "email_clicked" ? <MousePointerClick className="w-4 h-4" /> :
                     <DollarSign className="w-4 h-4" />}
                  </div>
                  {idx < journey.events.length - 1 && (
                    <div className="w-0.5 h-8 bg-border/30 mt-2" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-foreground">
                      {event.type === "added" ? "Added to sequence" :
                       event.type === "email_sent" ? `Email ${event.stepNumber} sent` :
                       event.type === "email_opened" ? `Email ${event.stepNumber} opened` :
                       event.type === "email_clicked" ? `Email ${event.stepNumber} clicked` :
                       "Made payment"}
                    </p>
                    {event.amount && (
                      <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs font-bold">
                        ₹{event.amount.toLocaleString()}
                      </span>
                    )}
                  </div>
                  {event.subject && (
                    <p className="text-xs text-muted-foreground mb-1">{event.subject}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{formatDateIST(event.date, "long")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Condition Card ─────────────────────────────────────────────
function ConditionCard({
  stepId,
  condition,
  conditionStats,
  onSave,
  onRemove,
  defaultOpen = false,
}: {
  stepId: string;
  condition: ConditionConfig | null;
  conditionStats?: { truePath: number; falsePath: number };
  onSave: (stepId: string, c: ConditionConfig) => void;
  onRemove: (stepId: string) => void;
  defaultOpen?: boolean;
}) {
  const [editing, setEditing] = useState(!condition || defaultOpen);
  const [draft, setDraft] = useState<ConditionConfig>(
    condition || {
      field: "opened_previous",
      true_action: "continue",
      false_action: "add_tag",
      false_tag: "cold-lead",
    }
  );

  if (!editing && condition) {
    return (
      <div className="relative py-1">
        <div className="mx-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-500/10">
            <GitBranch className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Condition Branch</span>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setEditing(true)}
                className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted/50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => onRemove(stepId)}
                className="text-[10px] text-muted-foreground hover:text-red-400 px-2 py-0.5 rounded-md hover:bg-red-400/10 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>

          {/* Paths */}
          <div className="px-4 py-3 grid grid-cols-2 gap-4">
            {/* True path */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">If True</span>
              </div>
              <p className="text-xs text-foreground/80 font-medium">
                {CONDITION_FIELDS.find(f => f.value === condition.field)?.label}
              </p>
              <p className="text-[10px] text-muted-foreground">
                → {ACTION_OPTIONS.find(a => a.value === condition.true_action)?.label}
                {condition.true_tag ? ` "${condition.true_tag}"` : ""}
              </p>
            </div>
            {/* False path */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">If False</span>
              </div>
              <p className="text-xs text-foreground/80 font-medium">
                Did not {CONDITION_FIELDS.find(f => f.value === condition.field)?.label?.toLowerCase()}
              </p>
              <p className="text-[10px] text-muted-foreground">
                → {ACTION_OPTIONS.find(a => a.value === condition.false_action)?.label}
                {condition.false_tag ? ` "${condition.false_tag}"` : ""}
              </p>
            </div>
          </div>

          {/* Stats */}
          {conditionStats && (conditionStats.truePath > 0 || conditionStats.falsePath > 0) && (
            <div className="px-4 py-2 border-t border-amber-500/10 flex items-center gap-3 bg-black/10">
              <span className="text-[10px] text-emerald-400 font-medium">{conditionStats.truePath} took true path</span>
              <span className="text-border/60">·</span>
              <span className="text-[10px] text-orange-400 font-medium">{conditionStats.falsePath} took false path</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative py-1">
      <div className="mx-6 rounded-2xl border border-primary/30 bg-primary/5 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-primary/20">
          <GitBranch className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Configure Branch Condition</span>
          <button
            onClick={() => condition ? setEditing(false) : onRemove(stepId)}
            className="ml-auto text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted/50 transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* IF field */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">IF contact...</label>
            <select
              value={draft.field}
              onChange={e => setDraft({ ...draft, field: e.target.value as ConditionConfig["field"] })}
              className="w-full h-9 px-3 rounded-xl bg-card border border-border/50 text-xs text-foreground focus:outline-none focus:border-primary/40 transition-colors"
            >
              {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          {/* True / False paths */}
          <div className="grid grid-cols-2 gap-3">
            {/* True */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                THEN (true path)
              </label>
              <select
                value={draft.true_action}
                onChange={e => setDraft({ ...draft, true_action: e.target.value as ConditionConfig["true_action"] })}
                className="w-full h-9 px-3 rounded-xl bg-card border border-border/50 text-xs text-foreground focus:outline-none focus:border-emerald-500/30 transition-colors"
              >
                {ACTION_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              {draft.true_action === "add_tag" && (
                <input
                  value={draft.true_tag || ""}
                  onChange={e => setDraft({ ...draft, true_tag: e.target.value })}
                  placeholder="Tag name (e.g. hot-lead)"
                  className="w-full h-8 px-3 rounded-xl bg-card border border-border/50 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                />
              )}
            </div>

            {/* False */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-orange-500 uppercase tracking-wider flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                ELSE (false path)
              </label>
              <select
                value={draft.false_action}
                onChange={e => setDraft({ ...draft, false_action: e.target.value as ConditionConfig["false_action"] })}
                className="w-full h-9 px-3 rounded-xl bg-card border border-border/50 text-xs text-foreground focus:outline-none focus:border-orange-500/30 transition-colors"
              >
                {ACTION_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              {draft.false_action === "add_tag" && (
                <input
                  value={draft.false_tag || ""}
                  onChange={e => setDraft({ ...draft, false_tag: e.target.value })}
                  placeholder="Tag name (e.g. cold-lead)"
                  className="w-full h-8 px-3 rounded-xl bg-card border border-border/50 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                />
              )}
            </div>
          </div>

          <button
            onClick={() => { onSave(stepId, draft); setEditing(false); }}
            className="w-full py-2 rounded-xl bg-primary text-black text-xs font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
          >
            <GitBranch className="w-3.5 h-3.5" />
            Save Condition Branch
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step Row Card ─────────────────────────────────────────────
function StepRow({
  step, index, dayLabel, delayLabel, stats,
  condition, conditionOpen, conditionStats,
  onPreview, onEdit, onDelete,
  onAddCondition, onSaveCondition, onRemoveCondition,
  pipelineCount, pipelineTimeLeft,
}: {
  step: any; index: number; dayLabel: string; delayLabel: string | null;
  stats: { sent: number; opened: number; clicked: number };
  condition: ConditionConfig | null;
  conditionOpen: boolean;
  conditionStats?: { truePath: number; falsePath: number };
  onPreview: () => void; onEdit: () => void; onDelete: () => void;
  onAddCondition: () => void;
  onSaveCondition: (stepId: string, c: ConditionConfig) => void;
  onRemoveCondition: (stepId: string) => void;
  pipelineCount?: number;
  pipelineTimeLeft?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const openPct = stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0;
  const clickPct = stats.sent > 0 ? Math.round((stats.clicked / stats.sent) * 100) : 0;

  return (
    <div>
      {/* Delay pill connector with pipeline animation */}
      {delayLabel && (
        <div className="my-2 px-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border/30" />
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-background ${
              pipelineCount && pipelineCount > 0 ? "border-primary/30" : "border-border/40"
            }`}>
              <Clock className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[10px] font-medium text-muted-foreground">{delayLabel}</span>
            </div>
            <div className="flex-1 h-px bg-border/30" />
          </div>
          {/* Pipeline flow indicator */}
          {pipelineCount !== undefined && pipelineCount > 0 && (
            <div className="flex items-center justify-center gap-2 mt-1.5">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" style={{ animationDelay: "200ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: "400ms" }} />
              </div>
              <span className="text-[10px] font-semibold text-primary">
                {pipelineCount} moving to next
              </span>
              {pipelineTimeLeft && (
                <span className="text-[10px] text-muted-foreground">
                  · {pipelineTimeLeft}
                </span>
              )}
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: "400ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" style={{ animationDelay: "200ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0ms" }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step card */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className="group bg-card border border-border/50 rounded-2xl hover:border-border hover:shadow-md transition-all overflow-hidden"
      >
        <div className="flex items-center gap-4 p-4">
          {/* Step number */}
          <div className="flex-shrink-0 w-9 h-9 rounded-full border-2 border-border/60 flex items-center justify-center group-hover:border-primary/30 transition-colors">
            <span className="text-sm font-bold text-muted-foreground group-hover:text-primary transition-colors">{index + 1}</span>
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">{dayLabel}</span>
              {condition && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 flex items-center gap-1">
                  <GitBranch className="w-2.5 h-2.5" />Branch
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-foreground leading-snug truncate pr-4">
              {step.email_subject}
            </p>
          </div>

          {/* Stats (desktop) */}
          <div className="hidden sm:flex items-center gap-6 flex-shrink-0 mr-2">
            <div className="text-center">
              <p className={`text-lg font-bold leading-tight ${openPct > 0 ? "text-emerald-400" : "text-muted-foreground/40"}`}>{openPct}%</p>
              <p className="text-[10px] text-muted-foreground">opens</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold leading-tight ${clickPct > 0 ? "text-blue-400" : "text-muted-foreground/40"}`}>{clickPct}%</p>
              <p className="text-[10px] text-muted-foreground">clicks</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold leading-tight text-muted-foreground/60">{stats.sent}</p>
              <p className="text-[10px] text-muted-foreground">sent</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
            <button onClick={onPreview} title="Preview" className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button onClick={onEdit} title="Edit" className="w-8 h-8 rounded-lg hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <div className="relative">
              <button onClick={() => setMenuOpen(m => !m)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-20 bg-card border border-border/60 rounded-xl shadow-xl overflow-hidden min-w-[140px]">
                  {!condition && !conditionOpen && (
                    <button onClick={() => { onAddCondition(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-amber-400 hover:bg-amber-400/10 transition-colors">
                      <GitBranch className="w-3 h-3" />Add condition
                    </button>
                  )}
                  <button onClick={() => { onDelete(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 className="w-3 h-3" />Delete step
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile stats row */}
        <div className="sm:hidden flex items-center gap-4 px-4 pb-3 border-t border-border/20 pt-2 ml-[52px]">
          <span className={`text-sm font-bold ${openPct > 0 ? "text-emerald-400" : "text-muted-foreground/40"}`}>{openPct}% opens</span>
          <span className="text-muted-foreground/30">·</span>
          <span className={`text-sm font-bold ${clickPct > 0 ? "text-blue-400" : "text-muted-foreground/40"}`}>{clickPct}% clicks</span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-sm text-muted-foreground">{stats.sent} sent</span>
        </div>

        {/* Add condition link (bottom of card, when no condition) */}
        {!condition && !conditionOpen && (
          <div className="border-t border-border/20 px-4 py-2.5">
            <button
              onClick={onAddCondition}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-amber-400 transition-colors group/btn"
            >
              <GitBranch className="w-3 h-3 group-hover/btn:text-amber-400" />
              Add condition after this step
            </button>
          </div>
        )}
      </motion.div>

      {/* Condition card (shown below step) */}
      <AnimatePresence>
        {(condition || conditionOpen) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <ConditionCard
              stepId={step.id}
              condition={condition}
              conditionStats={conditionStats}
              onSave={onSaveCondition}
              onRemove={onRemoveCondition}
              defaultOpen={conditionOpen && !condition}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
export default function Sequences() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedSeqId, setSelectedSeqId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showAddStep, setShowAddStep] = useState(false);
  const [previewStep, setPreviewStep] = useState<any>(null);
  const [editStep, setEditStep] = useState<any>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [detailTab, setDetailTab] = useState<"steps" | "performance" | "reports">("steps");
  const [dateFilter, setDateFilter] = useState("all");
  const [showCustomerJourney, setShowCustomerJourney] = useState<CustomerJourney | null>(null);
  
  // Track which step IDs have condition editor open
  const [conditionOpenSet, setConditionOpenSet] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [reportFilter, setReportFilter] = useState("all");

  // ── Date Range ──
  const dateRange = getDateRange(dateFilter);

  // ── Queries ──
  const { data: sequences = [], isLoading } = useQuery({
    queryKey: ["sequences"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_sequences").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: stepsMap = {} } = useQuery({
    queryKey: ["sequence-steps"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_sequence_steps").select("*").order("step_order");
      const map: Record<string, any[]> = {};
      (data || []).forEach((s: any) => { if (!map[s.sequence_id]) map[s.sequence_id] = []; map[s.sequence_id].push(s); });
      return map;
    },
  });

  // Enrollments with date filter support
  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments", dateFilter],
    queryFn: async () => {
      let query = supabase.from("automation_sequence_enrollments")
        .select("*");
      
      if (dateRange.start && dateRange.end) {
        query = query.gte("started_at", dateRange.start.toISOString())
                     .lt("started_at", dateRange.end.toISOString());
      }
      
      const { data } = await query;
      return data || [];
    },
  });

  // All enrollments for current active counts
  const { data: allEnrollments = [] } = useQuery({
    queryKey: ["all-enrollments"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_sequence_enrollments").select("*");
      return data || [];
    },
  });

  const { data: emailStats = {} } = useQuery({
    queryKey: ["email-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_email_log").select("step_id, status, opened_at, clicked_at, contYOUR_AD_ACCOUNT_IDid");
      const map: Record<string, { sent: number; opened: number; clicked: number }> = {};
      (data || []).forEach((e: any) => {
        if (!map[e.step_id]) map[e.step_id] = { sent: 0, opened: 0, clicked: 0 };
        map[e.step_id].sent++;
        if (e.opened_at) map[e.step_id].opened++;
        if (e.clicked_at) map[e.step_id].clicked++;
      });
      return map;
    },
  });

  // Email logs for conversion tracking
  const { data: emailLogs = [] } = useQuery({
    queryKey: ["email-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_email_log")
        .select("*")
        .order("sent_at", { ascending: false });
      return data || [];
    },
  });

  // Contacts for conversion data
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_contacts")
        .select("*");
      return data || [];
    },
  });

  // Enrollment positions for pipeline view
  const { data: enrollmentPositions = [] } = useQuery({
    queryKey: ["enrollment-positions"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_sequence_enrollments")
        .select("*");
      return data || [];
    },
  });

  // ── Derived Data ──
  const selectedSeq = sequences.find((s: any) => s.id === selectedSeqId) || null;
  const selectedSteps = selectedSeqId ? (stepsMap[selectedSeqId] || []) : [];
  
  // Calculate stats for selected sequence with date filter
  const seqEnrollments = enrollments.filter((e: any) => e.sequence_id === selectedSeqId);
  const seqAllEnrollments = allEnrollments.filter((e: any) => e.sequence_id === selectedSeqId);
  const newLeads = seqEnrollments.length;
  const activeLeads = seqAllEnrollments.filter((e: any) => e.status === "active").length;
  const completedLeads = seqAllEnrollments.filter((e: any) => e.status === "completed").length;

  // Conversions — REAL only: must have clicked an email CTA AND paid
  const detailedLogs = emailLogs;
  const contactsMap = new Map(contacts.map((c: any) => [c.id, c]));
  const seqContactIds = seqAllEnrollments.map((e: any) => e.contYOUR_AD_ACCOUNT_IDid);
  
  // Only count contacts who: 1) are enrolled, 2) clicked an email in this sequence, 3) paid
  const convertedContacts = contacts.filter((c: any) => {
    if (!seqContactIds.includes(c.id)) return false;
    if (!c.paid_299 && !c.purchased_50k) return false;
    // Must have clicked at least one email in this sequence
    const hasClicked = emailLogs.some((log: any) => 
      log.contYOUR_AD_ACCOUNT_IDid === c.id && log.sequence_id === selectedSeqId && log.clicked_at
    );
    return hasClicked;
  });
  const converted = convertedContacts.length;

  // Email stats for sequence
  const seqStats = selectedSteps.reduce(
    (acc: any, step: any) => {
      const s = emailStats[step.id] || { sent: 0, opened: 0, clicked: 0 };
      return { sent: acc.sent + s.sent, opened: acc.opened + s.opened, clicked: acc.clicked + s.clicked };
    },
    { sent: 0, opened: 0, clicked: 0 }
  );
  const avgOpenPct = seqStats.sent > 0 ? Math.round((seqStats.opened / seqStats.sent) * 100) : 0;
  const avgClickPct = seqStats.sent > 0 ? Math.round((seqStats.clicked / seqStats.sent) * 100) : 0;

  // Pipeline data
  const pipelineData = selectedSteps.map((step: any, idx: number) => {
    const stepOrder = step.step_order || idx + 1;
    const atThisStep = enrollmentPositions.filter((e: any) => 
      e.sequence_id === selectedSeqId && e.status === "active" && e.current_step === stepOrder
    ).length;
    return { step: stepOrder, count: atThisStep, subject: step.email_subject };
  });

  // Daily leads tracking
  const dailyLeads = enrollments
    .filter((e: any) => e.sequence_id === selectedSeqId)
    .reduce((acc: Record<string, number>, enrollment: any) => {
      const date = new Date(enrollment.started_at).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short"
      });
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

  const dailyLeadsArray = Object.entries(dailyLeads)
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .slice(0, 7);

  // Conversion table data
  const conversionTableData = convertedContacts.map((contact: any) => {
    const enrollment = seqAllEnrollments.find((e: any) => e.contYOUR_AD_ACCOUNT_IDid === contact.id);
    const contactLogs = emailLogs.filter((log: any) => log.contYOUR_AD_ACCOUNT_IDid === contact.id && log.sequence_id === selectedSeqId);
    
    const firstOpen = contactLogs.find((log: any) => log.opened_at);
    const firstClick = contactLogs.find((log: any) => log.clicked_at);
    
    const paymentDate = contact.paid_299_at || contact.purchased_50k_at;
    const amount = contact.paid_299 ? 299 : contact.higher_ticket_amount || 0;
    
    return {
      contYOUR_AD_ACCOUNT_IDid: contact.id,
      name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unknown",
      email: contact.email,
      step_when_paid: enrollment?.current_step || 1,
      started_at: enrollment?.started_at,
      opened_at: firstOpen?.opened_at,
      clicked_at: firstClick?.clicked_at,
      paid_at: paymentDate,
      amount
    };
  });

  // ── Mutations ──
  const createSeq = useMutation({
    mutationFn: async () => {
      await supabase.from("automation_sequences").insert({ name: newName, description: newDesc, status: "paused" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sequences"] }); setShowCreate(false); setNewName(""); setNewDesc(""); toast.success("Sequence created!"); },
    onError: () => toast.error("Failed to create sequence"),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from("automation_sequences").update({ status: status === "active" ? "paused" : "active" }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sequences"] }),
  });

  const deleteSeq = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("automation_sequence_steps").delete().eq("sequence_id", id);
      await supabase.from("automation_sequence_enrollments").delete().eq("sequence_id", id);
      await supabase.from("automation_sequences").delete().eq("id", id);
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["sequences"] });
      if (selectedSeqId === id) { setSelectedSeqId(null); setMobileView("list"); }
    },
  });

  const addStep = useMutation({
    mutationFn: async ({ seqId, subject, body, waitHours }: { seqId: string; subject: string; body: string; waitHours: number }) => {
      const steps = stepsMap[seqId] || [];
      await supabase.from("automation_sequence_steps").insert({
        sequence_id: seqId, step_order: steps.length + 1,
        email_subject: subject, email_body: body, wait_hours: waitHours,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sequence-steps"] }); setShowAddStep(false); toast.success("Email step added!"); },
    onError: () => toast.error("Failed to add step"),
  });

  const updateStep = useMutation({
    mutationFn: async ({ id, subject, body }: { id: string; subject: string; body: string }) => {
      await supabase.from("automation_sequence_steps").update({ email_subject: subject, email_body: body }).eq("id", id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sequence-steps"] }); setEditStep(null); },
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => { await supabase.from("automation_sequence_steps").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sequence-steps"] }),
  });

  const saveCondition = useMutation({
    mutationFn: async ({ stepId, condition, existingConfig }: { stepId: string; condition: ConditionConfig; existingConfig: any }) => {
      const updatedConfig = { ...(existingConfig || {}), condition };
      await supabase.from("automation_sequence_steps").update({ config: updatedConfig }).eq("id", stepId);
    },
    onSuccess: (_, { stepId }) => {
      qc.invalidateQueries({ queryKey: ["sequence-steps"] });
      setConditionOpenSet(prev => { const s = new Set(prev); s.delete(stepId); return s; });
      toast.success("Condition saved!");
    },
    onError: () => toast.error("Failed to save condition"),
  });

  const removeCondition = useMutation({
    mutationFn: async ({ stepId, existingConfig }: { stepId: string; existingConfig: any }) => {
      const updatedConfig = { ...(existingConfig || {}) };
      delete updatedConfig.condition;
      await supabase.from("automation_sequence_steps").update({ config: updatedConfig }).eq("id", stepId);
    },
    onSuccess: (_, { stepId }) => {
      qc.invalidateQueries({ queryKey: ["sequence-steps"] });
      setConditionOpenSet(prev => { const s = new Set(prev); s.delete(stepId); return s; });
      toast.success("Condition removed");
    },
    onError: () => toast.error("Failed to remove condition"),
  });

  // ── Condition handlers ──
  const handleAddCondition = (stepId: string) => {
    setConditionOpenSet(prev => new Set([...prev, stepId]));
  };

  const handleSaveCondition = (stepId: string, condition: ConditionConfig) => {
    const step = selectedSteps.find((s: any) => s.id === stepId);
    saveCondition.mutate({ stepId, condition, existingConfig: step?.config || {} });
  };

  const handleRemoveCondition = (stepId: string) => {
    const step = selectedSteps.find((s: any) => s.id === stepId);
    if (step?.config?.condition) {
      removeCondition.mutate({ stepId, existingConfig: step.config });
    } else {
      setConditionOpenSet(prev => { const s = new Set(prev); s.delete(stepId); return s; });
    }
  };

  // ── Customer Journey Handler ──
  const handleShowJourney = (contactId: string) => {
    const contact = contactsMap.get(contactId);
    if (!contact) return;

    const enrollment = seqAllEnrollments.find((e: any) => e.contYOUR_AD_ACCOUNT_IDid === contactId);
    const contactLogs = emailLogs.filter((log: any) => log.contYOUR_AD_ACCOUNT_IDid === contactId && log.sequence_id === selectedSeqId);
    
    const events: CustomerJourney['events'] = [];
    
    // Lead added
    if (enrollment?.started_at) {
      events.push({
        type: "added",
        date: enrollment.started_at
      });
    }

    // Email events
    contactLogs.forEach((log: any) => {
      const step = selectedSteps.find((s: any) => s.id === log.step_id);
      const stepNumber = step?.step_order || 1;
      
      // Email sent
      if (log.sent_at) {
        events.push({
          type: "email_sent",
          date: log.sent_at,
          stepNumber,
          subject: log.subject
        });
      }
      
      // Email opened
      if (log.opened_at) {
        events.push({
          type: "email_opened",
          date: log.opened_at,
          stepNumber,
          subject: log.subject
        });
      }
      
      // Email clicked
      if (log.clicked_at) {
        events.push({
          type: "email_clicked", 
          date: log.clicked_at,
          stepNumber,
          subject: log.subject
        });
      }
    });

    // Payment
    if (contact.paid_299_at || contact.purchased_50k_at) {
      events.push({
        type: "paid",
        date: contact.paid_299_at || contact.purchased_50k_at,
        amount: contact.paid_299 ? 299 : contact.higher_ticket_amount || 0
      });
    }

    // Sort by date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setShowCustomerJourney({
      contYOUR_AD_ACCOUNT_IDid: contactId,
      name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unknown",
      email: contact.email,
      events
    });
  };

  return (
    <Layout>
      <div className="flex gap-5 h-full">

        {/* ── Left: Sequence list ── */}
        <div className={`flex-shrink-0 w-full md:w-72 flex flex-col gap-3 ${mobileView === "detail" ? "hidden md:flex" : "flex"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4.5 h-4.5 text-primary" />
              <h1 className="text-base font-bold text-foreground">Sequences</h1>
              <span className="text-[11px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md">{sequences.length}</span>
            </div>
            <button
              onClick={() => setShowCreate(v => !v)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-black text-xs font-bold hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />New
            </button>
          </div>

          <AnimatePresence>
            {showCreate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-card border border-primary/20 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-foreground">New Sequence</p>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name (e.g. Lead Nurture)" className="w-full h-9 px-3 rounded-xl bg-background border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 transition-colors" />
                  <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" className="w-full h-9 px-3 rounded-xl bg-background border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 transition-colors" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl bg-muted/50 text-muted-foreground text-xs font-semibold hover:bg-muted transition-colors">Cancel</button>
                    <button onClick={() => createSeq.mutate()} disabled={!newName} className="flex-1 py-2 rounded-xl bg-primary text-black text-xs font-bold disabled:opacity-30 hover:bg-primary/90 transition-colors">Create</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card border border-border/50 rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted/50 rounded w-1/2" />
              </div>
            ))
          ) : sequences.length === 0 ? (
            <div className="bg-card border border-dashed border-border/50 rounded-2xl p-6 text-center">
              <Zap className="w-7 h-7 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No sequences yet</p>
            </div>
          ) : (
            sequences.map((seq: any) => {
              const seqAllEnrolls = allEnrollments.filter((e: any) => e.sequence_id === seq.id);
              const activeCount = seqAllEnrolls.filter((e: any) => e.status === "active").length;
              const completedCount = seqAllEnrolls.filter((e: any) => e.status === "completed").length;
              const steps = stepsMap[seq.id] || [];
              const isSelected = selectedSeqId === seq.id;
              const isActive = seq.status === "active";
              return (
                <motion.button
                  key={seq.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => { setSelectedSeqId(seq.id); setMobileView("detail"); }}
                  className={`text-left w-full bg-card border rounded-2xl p-4 transition-all ${
                    isSelected ? "border-primary/40 shadow-md shadow-primary/10" : "border-border/50 hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-emerald-500" : "bg-muted-foreground/25"}`} />
                    <p className="text-sm font-semibold text-foreground truncate">{seq.name}</p>
                    <ChevronRight className={`w-3.5 h-3.5 ml-auto flex-shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground/30"}`} />
                  </div>
                  {seq.description && <p className="text-[11px] text-muted-foreground/70 truncate mb-2 pl-4">{seq.description}</p>}
                  <div className="flex items-center gap-3 pl-4 text-[11px] text-muted-foreground">
                    <span>{steps.length} emails</span>
                    <span className="text-border">·</span>
                    <span>{activeCount} leads added</span>
                    <span className="text-border">·</span>
                    <span>{completedCount} done</span>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>

        {/* ── Right: Detail ── */}
        <div className={`flex-1 min-w-0 flex flex-col gap-4 ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
          {!selectedSeq ? (
            <div className="hidden md:flex flex-col items-center justify-center flex-1 bg-card border border-dashed border-border/40 rounded-2xl text-center p-12">
              <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Select a sequence</p>
              <p className="text-xs text-muted-foreground/50 mt-1">Click any sequence to view and edit its emails</p>
            </div>
          ) : (
            <>
              {/* Sequence header card */}
              <div className="bg-card border border-border/50 rounded-2xl p-5">
                <button onClick={() => setMobileView("list")} className="md:hidden flex items-center gap-1.5 text-xs text-muted-foreground mb-3 hover:text-foreground transition-colors">
                  ← Back to sequences
                </button>

                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-base font-bold text-foreground">{selectedSeq.name}</h2>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedSeq.status === "active" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted/60 text-muted-foreground"}`}>
                        {selectedSeq.status === "active" ? "Active" : "Paused"}
                      </span>
                    </div>
                    {selectedSeq.description && <p className="text-xs text-muted-foreground mb-4">{selectedSeq.description}</p>}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Leads Added", value: newLeads, icon: Users, color: "text-foreground" },
                        { label: "Currently Active", value: activeLeads, icon: Activity, color: "text-emerald-400" },
                        { label: "Completed", value: completedLeads, icon: CheckCircle, color: "text-foreground" },
                        { label: "Converted", value: converted, icon: Target, color: converted > 0 ? "text-green-400" : "text-muted-foreground/40" },
                      ].map(stat => {
                        const Icon = stat.icon;
                        return (
                          <div key={stat.label} className="bg-background/60 rounded-xl p-3">
                            <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                              <Icon className="w-3 h-3" />{stat.label}
                            </p>
                            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleStatus.mutate({ id: selectedSeq.id, status: selectedSeq.status })}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        selectedSeq.status === "active"
                          ? "bg-muted/60 text-muted-foreground hover:bg-muted"
                          : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                      }`}
                    >
                      {selectedSeq.status === "active" ? <><Pause className="w-3.5 h-3.5" />Pause</> : <><Play className="w-3.5 h-3.5" />Activate</>}
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${selectedSeq.name}"?`)) deleteSeq.mutate(selectedSeq.id); }}
                      className="w-8 h-8 rounded-xl hover:bg-red-500/10 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tab Switcher */}
              <div className="flex gap-1 bg-card border border-border/50 rounded-2xl p-1">
                <button
                  onClick={() => setDetailTab("steps")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    detailTab === "steps" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />Steps & Emails
                </button>
                <button
                  onClick={() => setDetailTab("performance")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    detailTab === "performance" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />Performance
                </button>
                <button
                  onClick={() => setDetailTab("reports")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    detailTab === "reports" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />Reports
                </button>
              </div>

              {detailTab === "performance" ? (
                /* ── PERFORMANCE VIEW ── */
                <div className="space-y-4">
                  
                  {/* Date Filter Header */}
                  <div className="bg-card border border-border/50 rounded-2xl p-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">Performance Analytics</h3>
                        <p className="text-xs text-muted-foreground">Track conversions and lead flow</p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <select 
                            value={dateFilter} 
                            onChange={e => setDateFilter(e.target.value)}
                            className="bg-background border border-border/50 rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/40"
                          >
                            {DATE_FILTERS.map(filter => (
                              <option key={filter.value} value={filter.value}>{filter.label}</option>
                            ))}
                          </select>
                        </div>
                        
                        <button
                          onClick={async () => { 
                            setRefreshing(true);
                            await Promise.all([
                              qc.refetchQueries({ queryKey: ["enrollments"] }),
                              qc.refetchQueries({ queryKey: ["all-enrollments"] }),
                              qc.refetchQueries({ queryKey: ["email-logs"] }),
                              qc.refetchQueries({ queryKey: ["contacts"] }),
                              qc.refetchQueries({ queryKey: ["email-stats"] }),
                              qc.refetchQueries({ queryKey: ["enrollment-positions"] }),
                            ]);
                            setTimeout(() => setRefreshing(false), 500);
                          }}
                          disabled={refreshing}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-background border border-border/50 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                          {refreshing ? "Refreshing..." : "Refresh"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Pipeline Funnel View */}
                  <div className="bg-card border border-border/50 rounded-2xl p-5">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Pipeline Funnel</h4>
                    
                    <div className="space-y-3">
                      {pipelineData.map((stage, idx) => {
                        const isLast = idx === pipelineData.length - 1;
                        const maxCount = Math.max(...pipelineData.map(p => p.count));
                        const widthPercent = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
                        
                        return (
                          <div key={stage.step} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                  {stage.step}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {stage.subject?.replace(/\{\{first_name\}\}/g, "[Name]") || `Email ${stage.step}`}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-primary">{stage.count}</p>
                                <p className="text-xs text-muted-foreground">leads here</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-6 bg-background rounded-lg overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-primary/50 to-primary/30 rounded-lg transition-all duration-500"
                                  style={{ width: `${widthPercent}%` }}
                                />
                              </div>
                            </div>
                            
                            {!isLast && (
                              <div className="flex justify-center my-2">
                                <ArrowDown className="w-4 h-4 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Completion */}
                      <div className="pt-2 border-t border-border/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold flex items-center justify-center">
                              ✓
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">Completed Sequence</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-emerald-400">{completedLeads}</p>
                            <p className="text-xs text-muted-foreground">finished</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Daily Lead Tracking */}
                  <div className="bg-card border border-border/50 rounded-2xl p-5">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Daily Leads Added</h4>
                    
                    {dailyLeadsArray.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No leads in selected period</p>
                    ) : (
                      <div className="space-y-2">
                        {dailyLeadsArray.map(([date, count]) => {
                          const maxDaily = Math.max(...dailyLeadsArray.map(([, c]) => c));
                          const widthPercent = maxDaily > 0 ? (count / maxDaily) * 100 : 0;
                          
                          return (
                            <div key={date} className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground w-16 text-right">{date}</span>
                              <div className="flex-1 h-6 bg-background rounded-lg overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500/40 rounded-lg transition-all duration-500"
                                  style={{ width: `${widthPercent}%` }}
                                />
                              </div>
                              <span className="text-sm font-bold text-foreground w-8">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Conversion Table (Most Important) */}
                  <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border/20 bg-green-500/5">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <h4 className="text-sm font-bold text-green-400">Conversion Analysis</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">People who paid - which email step triggered the conversion?</p>
                    </div>
                    
                    {conversionTableData.length === 0 ? (
                      <div className="p-6 text-center">
                        <Target className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No conversions yet</p>
                        <p className="text-xs text-muted-foreground/60">Converted customers will appear here</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-background/50">
                            <tr className="text-left">
                              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Customer</th>
                              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Step When Paid</th>
                              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Added</th>
                              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">First Open</th>
                              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">First Click</th>
                              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Purchased</th>
                              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                              <th className="px-4 py-3 text-xs font-medium text-muted-foreground"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {conversionTableData.map((row) => (
                              <tr key={row.contYOUR_AD_ACCOUNT_IDid} className="border-t border-border/20 hover:bg-background/30 transition-colors">
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{row.name}</p>
                                    <p className="text-xs text-muted-foreground">{row.email}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-bold">
                                    Email {row.step_when_paid}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                  {formatDateIST(row.started_at)}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                  {formatDateIST(row.opened_at)}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                  {formatDateIST(row.clicked_at)}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                  {formatDateIST(row.paid_at)}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-bold">
                                    ₹{row.amount?.toLocaleString() || 0}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => handleShowJourney(row.contYOUR_AD_ACCOUNT_IDid)}
                                    className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Journey
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : detailTab === "reports" ? (
                /* ── REPORTS VIEW ── */
                <div className="space-y-4">
                  {/* Report Header with Refresh */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Sequence Reports</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {seqStats.sent} sent · {seqStats.opened} opened ({avgOpenPct}%) · {seqStats.clicked} clicked ({avgClickPct}%)
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        setRefreshing(true);
                        await Promise.all([
                          qc.refetchQueries({ queryKey: ["email-logs"] }),
                          qc.refetchQueries({ queryKey: ["email-stats"] }),
                          qc.refetchQueries({ queryKey: ["contacts"] }),
                          qc.refetchQueries({ queryKey: ["enrollments"] }),
                          qc.refetchQueries({ queryKey: ["enrollment-positions"] }),
                        ]);
                        setTimeout(() => setRefreshing(false), 500);
                      }}
                      disabled={refreshing}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border/50 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                      {refreshing ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>

                  {/* Overall funnel summary */}
                  <div className="bg-card border border-border/50 rounded-2xl p-5">
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div className="text-center">
                        <div className="w-9 h-9 mx-auto rounded-xl bg-muted/50 flex items-center justify-center mb-1.5">
                          <Send className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <p className="text-xl font-bold text-foreground">{seqStats.sent}</p>
                        <p className="text-[10px] text-muted-foreground">Total Sent</p>
                      </div>
                      <div className="text-center">
                        <div className="w-9 h-9 mx-auto rounded-xl bg-emerald-500/10 flex items-center justify-center mb-1.5">
                          <Eye className="w-4 h-4 text-emerald-400" />
                        </div>
                        <p className="text-xl font-bold text-emerald-400">{seqStats.opened}</p>
                        <p className="text-[10px] text-muted-foreground">{avgOpenPct}% Opened</p>
                      </div>
                      <div className="text-center">
                        <div className="w-9 h-9 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-1.5">
                          <MousePointerClick className="w-4 h-4 text-primary" />
                        </div>
                        <p className="text-xl font-bold text-primary">{seqStats.clicked}</p>
                        <p className="text-[10px] text-muted-foreground">{avgClickPct}% Clicked</p>
                      </div>
                      <div className="text-center">
                        <div className="w-9 h-9 mx-auto rounded-xl bg-blue-500/10 flex items-center justify-center mb-1.5">
                          <TrendingUp className="w-4 h-4 text-blue-400" />
                        </div>
                        <p className="text-xl font-bold text-blue-400">
                          {detailedLogs.filter((l: any) => l.sequence_id === selectedSeqId && l.clicked_at && contactsMap.get(l.contYOUR_AD_ACCOUNT_IDid)?.paid_299).reduce((ids: Set<string>, l: any) => ids.add(l.contYOUR_AD_ACCOUNT_IDid), new Set<string>()).size}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Converted ₹299</p>
                      </div>
                    </div>
                    {/* Full funnel bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-14 text-right text-muted-foreground">Sent</span>
                        <div className="flex-1 h-3 bg-background rounded-full overflow-hidden"><div className="h-full bg-muted-foreground/30 rounded-full" style={{ width: "100%" }} /></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-14 text-right text-emerald-400">Opened</span>
                        <div className="flex-1 h-3 bg-background rounded-full overflow-hidden"><div className="h-full bg-emerald-500/50 rounded-full transition-all" style={{ width: seqStats.sent > 0 ? `${(seqStats.opened / seqStats.sent * 100)}%` : "0%" }} /></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] w-14 text-right text-primary">Clicked</span>
                        <div className="flex-1 h-3 bg-background rounded-full overflow-hidden"><div className="h-full bg-primary/50 rounded-full transition-all" style={{ width: seqStats.sent > 0 ? `${(seqStats.clicked / seqStats.sent * 100)}%` : "0%" }} /></div>
                      </div>
                    </div>
                  </div>

                  {/* ── Sequence Timeline ── */}
                  {(() => {
                    const seqEnrollmentsR = enrollmentPositions.filter((e: any) => e.sequence_id === selectedSeqId);
                    const activeEnrollmentsR = seqEnrollmentsR.filter((e: any) => e.status === "active");
                    const completedEnrollmentsR = seqEnrollmentsR.filter((e: any) => e.status === "completed");
                    const stoppedEnrollmentsR = seqEnrollmentsR.filter((e: any) => e.status === "stopped");
                    const emailStepsR = selectedSteps.filter((s: any) => s.step_type === "email");
                    const stepCountsR: Record<number, number> = {};
                    activeEnrollmentsR.forEach((e: any) => { stepCountsR[e.current_step] = (stepCountsR[e.current_step] || 0) + 1; });

                    const timeUntil = (ms: number) => {
                      const hours = Math.floor(ms / 3600000);
                      const mins = Math.floor((ms % 3600000) / 60000);
                      if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
                      if (hours > 0) return `${hours}h ${mins}m`;
                      return `${mins}m`;
                    };

                    return (
                      <div className="bg-card border border-border/50 rounded-2xl p-5">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Sequence Timeline</h3>
                        <div className="relative">
                          {emailStepsR.map((step: any, idx: number) => {
                            const stepOrder = step.step_order || idx + 1;
                            const waiting = stepCountsR[stepOrder] || 0;
                            const stepLogs = detailedLogs.filter((l: any) => l.step_id === step.id && l.sequence_id === selectedSeqId);
                            const sent = stepLogs.length;
                            const opened = stepLogs.filter((l: any) => l.opened_at).length;
                            const isDone = sent > 0 && waiting === 0;
                            const isActive = waiting > 0;
                            const isPending = sent === 0 && waiting === 0;
                            const nextStepSends = activeEnrollmentsR
                              .filter((e: any) => e.current_step === stepOrder && e.next_send_at)
                              .map((e: any) => new Date(e.next_send_at).getTime())
                              .sort((a: number, b: number) => a - b);
                            const nextForThisStep = nextStepSends.length > 0 ? nextStepSends[0] : null;
                            const isLast = idx === emailStepsR.length - 1;
                            const now = Date.now();

                            return (
                              <div key={step.id} className="flex gap-3 mb-0">
                                <div className="flex flex-col items-center w-8 flex-shrink-0">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                    isDone ? "bg-emerald-500/20 text-emerald-400" :
                                    isActive ? "bg-primary/20 text-primary ring-2 ring-primary/30" :
                                    "bg-muted/50 text-muted-foreground"
                                  }`}>
                                    {isDone ? "✓" : idx + 1}
                                  </div>
                                  {!isLast && (
                                    <div className={`w-0.5 flex-1 min-h-[40px] ${isDone ? "bg-emerald-500/30" : isActive ? "bg-primary/20" : "bg-border/50"}`} />
                                  )}
                                </div>
                                <div className={`flex-1 pb-5 ${isLast ? "pb-0" : ""}`}>
                                  <p className={`text-sm font-semibold ${isDone ? "text-emerald-400" : isActive ? "text-foreground" : "text-muted-foreground"}`}>
                                    {step.email_subject?.replace(/\{\{first_name\}\}/g, "[Name]")}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {isDone && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">
                                        ✅ Sent to {sent} · {opened} opened ({sent > 0 ? Math.round(opened / sent * 100) : 0}%)
                                      </span>
                                    )}
                                    {isActive && nextForThisStep && nextForThisStep > now && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                        ⏳ {waiting} waiting · sends in {timeUntil(nextForThisStep - now)}
                                      </span>
                                    )}
                                    {isActive && (!nextForThisStep || nextForThisStep <= now) && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">
                                        🔄 {waiting} queued
                                      </span>
                                    )}
                                    {isPending && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground font-medium">
                                        ⏱️ {step.wait_hours === 0 ? "Sends immediately" : `Sends ${step.wait_hours}h after previous`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {activeEnrollmentsR.length} active</span>
                          <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-400" /> {completedEnrollmentsR.length} completed</span>
                          {stoppedEnrollmentsR.length > 0 && (
                            <span className="flex items-center gap-1"><UserX className="w-3 h-3 text-red-400" /> {stoppedEnrollmentsR.length} stopped</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Per-step breakdown */}
                  {selectedSteps.filter((s: any) => s.step_type === "email").map((step: any, idx: number) => {
                    const stepLogs = detailedLogs.filter((l: any) => l.step_id === step.id && l.sequence_id === selectedSeqId);
                    const sent = stepLogs.length;
                    const opened = stepLogs.filter((l: any) => l.opened_at).length;
                    const clicked = stepLogs.filter((l: any) => l.clicked_at).length;
                    const converted = stepLogs.filter((l: any) => { const c = contactsMap.get(l.contYOUR_AD_ACCOUNT_IDid); return c?.paid_299; }).length;
                    const pct = (n: number, d: number) => d === 0 ? "0%" : (n / d * 100).toFixed(1) + "%";
                    const fmtDateR = (d: string | null) => {
                      if (!d) return "—";
                      return new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
                    };

                    const filtered = stepLogs.filter((l: any) => {
                      if (reportFilter === "opened") return l.opened_at;
                      if (reportFilter === "clicked") return l.clicked_at;
                      if (reportFilter === "not_opened") return !l.opened_at;
                      return true;
                    });

                    return (
                      <div key={step.id} className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                        <div className="p-5 border-b border-border/30">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">{idx + 1}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{step.email_subject?.replace(/\{\{first_name\}\}/g, "[Name]")}</p>
                              <p className="text-[11px] text-muted-foreground">{step.wait_hours === 0 ? "Sends immediately" : `Sends after ${step.wait_hours}h`}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            <div className="bg-background/60 rounded-xl p-3 text-center">
                              <p className="text-lg font-bold text-foreground">{sent}</p>
                              <p className="text-[10px] text-muted-foreground">Sent</p>
                            </div>
                            <div className="bg-background/60 rounded-xl p-3 text-center">
                              <p className="text-lg font-bold text-emerald-400">{opened}</p>
                              <p className="text-[10px] text-muted-foreground">{pct(opened, sent)} opened</p>
                            </div>
                            <div className="bg-background/60 rounded-xl p-3 text-center">
                              <p className="text-lg font-bold text-primary">{clicked}</p>
                              <p className="text-[10px] text-muted-foreground">{pct(clicked, sent)} clicked</p>
                            </div>
                            <div className="bg-background/60 rounded-xl p-3 text-center">
                              <p className="text-lg font-bold text-blue-400">{converted}</p>
                              <p className="text-[10px] text-muted-foreground">Converted</p>
                            </div>
                          </div>
                          <div className="mt-3 space-y-1">
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="w-12 text-muted-foreground text-right">Sent</span>
                              <div className="flex-1 h-4 bg-background rounded-lg overflow-hidden"><div className="h-full bg-muted-foreground/20 rounded-lg" style={{ width: "100%" }} /></div>
                              <span className="w-8 text-muted-foreground">{sent}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="w-12 text-emerald-400 text-right">Opened</span>
                              <div className="flex-1 h-4 bg-background rounded-lg overflow-hidden"><div className="h-full bg-emerald-500/40 rounded-lg transition-all" style={{ width: sent > 0 ? `${(opened / sent * 100)}%` : "0%" }} /></div>
                              <span className="w-8 text-emerald-400">{opened}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="w-12 text-primary text-right">Clicked</span>
                              <div className="flex-1 h-4 bg-background rounded-lg overflow-hidden"><div className="h-full bg-primary/40 rounded-lg transition-all" style={{ width: sent > 0 ? `${(clicked / sent * 100)}%` : "0%" }} /></div>
                              <span className="w-8 text-primary">{clicked}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 px-5 py-3 border-b border-border/20">
                          {(["all", "opened", "clicked", "not_opened"] as const).map(f => (
                            <button key={f} onClick={() => setReportFilter(f)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                                reportFilter === f ? "bg-primary/20 text-primary" : "bg-background text-muted-foreground hover:text-foreground"
                              }`}>
                              {f === "all" ? `All (${sent})` : f === "opened" ? `Opened (${opened})` : f === "clicked" ? `Clicked (${clicked})` : `Not Opened (${sent - opened})`}
                            </button>
                          ))}
                        </div>
                        <div className="max-h-[350px] overflow-y-auto">
                          {filtered.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">No records</p>
                          ) : (
                            filtered.map((log: any) => {
                              const contact = contactsMap.get(log.contYOUR_AD_ACCOUNT_IDid);
                              const name = contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unknown" : "Unknown";
                              return (
                                <div key={log.id} className="flex items-center gap-3 py-3 px-5 border-b border-border/20 last:border-0 hover:bg-background/50 transition-colors">
                                  <div className="w-7 h-7 rounded-full bg-background flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                                    {(contact?.first_name || "?")[0].toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">{name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{log.email_to}</p>
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] flex-shrink-0">
                                    {log.opened_at ? (
                                      <span className="flex items-center gap-1 text-emerald-400"><Eye className="w-3 h-3" />{fmtDateR(log.opened_at)}</span>
                                    ) : (
                                      <span className="text-muted-foreground/30 flex items-center gap-1"><Eye className="w-3 h-3" />—</span>
                                    )}
                                    {log.clicked_at ? (
                                      <span className="flex items-center gap-1 text-primary"><MousePointerClick className="w-3 h-3" />{fmtDateR(log.clicked_at)}</span>
                                    ) : (
                                      <span className="text-muted-foreground/30 flex items-center gap-1"><MousePointerClick className="w-3 h-3" />—</span>
                                    )}
                                    {contact?.paid_299 && (
                                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">₹299</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {selectedSteps.filter((s: any) => s.step_type === "email").length === 0 && (
                    <div className="bg-card border border-dashed border-border/40 rounded-2xl p-8 text-center">
                      <BarChart2 className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No email data yet</p>
                    </div>
                  )}
                </div>
              ) : (
              <>
              {/* Trigger */}
              <div className="flex items-center gap-3 px-5 py-3.5 bg-card border border-border/50 rounded-2xl">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-muted-foreground font-medium">Trigger</p>
                  <p className="text-sm font-semibold text-foreground">New lead tagged "lead"</p>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-400">Auto</span>
              </div>

              {/* Steps */}
              <div className="space-y-0">
                {selectedSteps.length === 0 ? (
                  <div className="bg-card border border-dashed border-border/40 rounded-2xl p-8 text-center">
                    <Mail className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">No emails yet</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">Add your first email step below</p>
                  </div>
                ) : (
                  selectedSteps.map((step: any, idx: number) => {
                    const cumHours = selectedSteps.slice(0, idx + 1).reduce((acc: number, s: any) => acc + (s.wait_hours || 0), 0);
                    const dayLabel = cumHours === 0 ? "Day 0" : cumHours < 24 ? `${cumHours}h` : `Day ${Math.round(cumHours / 24)}`;
                    const delayLabel = idx > 0 && step.wait_hours > 0
                      ? step.wait_hours < 24 ? `Wait ${step.wait_hours} hours` : `Wait ${Math.round(step.wait_hours / 24)} day${Math.round(step.wait_hours / 24) !== 1 ? "s" : ""}`
                      : null;
                    const stats = emailStats[step.id] || { sent: 0, opened: 0, clicked: 0 };
                    const condition: ConditionConfig | null = step.config?.condition || null;
                    const conditionOpen = conditionOpenSet.has(step.id);
                    const conditionStats = condition && stats.sent > 0
                      ? { truePath: stats.opened, falsePath: stats.sent - stats.opened }
                      : undefined;

                    // Pipeline: how many people are waiting at this step's position
                    const stepOrder = step.step_order || idx + 1;
                    const waitingAtStep = enrollmentPositions.filter(
                      (e: any) => e.sequence_id === selectedSeqId && e.status === "active" && e.current_step === stepOrder
                    );
                    const pipelineCount = waitingAtStep.length;
                    // Calculate time left for nearest send
                    let pipelineTimeLeft: string | undefined;
                    if (pipelineCount > 0) {
                      const nextSends = waitingAtStep
                        .filter((e: any) => e.next_send_at)
                        .map((e: any) => new Date(e.next_send_at).getTime())
                        .sort((a: number, b: number) => a - b);
                      if (nextSends.length > 0) {
                        const ms = nextSends[0] - Date.now();
                        if (ms > 0) {
                          const hours = Math.floor(ms / 3600000);
                          const mins = Math.floor((ms % 3600000) / 60000);
                          pipelineTimeLeft = hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h left` :
                            hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
                        } else {
                          pipelineTimeLeft = "sending now";
                        }
                      }
                    }

                    return (
                      <div key={step.id} className="mb-2">
                        <StepRow
                          step={step}
                          index={idx}
                          dayLabel={dayLabel}
                          delayLabel={delayLabel}
                          stats={stats}
                          condition={condition}
                          conditionOpen={conditionOpen}
                          conditionStats={conditionStats}
                          pipelineCount={pipelineCount}
                          pipelineTimeLeft={pipelineTimeLeft}
                          onPreview={() => setPreviewStep(step)}
                          onEdit={() => setEditStep(step)}
                          onDelete={() => deleteStep.mutate(step.id)}
                          onAddCondition={() => handleAddCondition(step.id)}
                          onSaveCondition={handleSaveCondition}
                          onRemoveCondition={handleRemoveCondition}
                        />
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add step */}
              <button
                onClick={() => setShowAddStep(true)}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl border-2 border-dashed border-border/40 text-muted-foreground text-sm font-semibold hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Email Step
              </button>
            </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddStep && selectedSeqId && (
        <AddStepModal
          onClose={() => setShowAddStep(false)}
          onAdd={(subject, body, waitHours) => addStep.mutate({ seqId: selectedSeqId, subject, body, waitHours })}
        />
      )}
      {previewStep && <PreviewModal step={previewStep} onClose={() => setPreviewStep(null)} />}
      {editStep && <EditModal step={editStep} onClose={() => setEditStep(null)} onSave={(subject, body) => updateStep.mutate({ id: editStep.id, subject, body })} />}
      {showCustomerJourney && <CustomerJourneyModal journey={showCustomerJourney} onClose={() => setShowCustomerJourney(null)} />}
    </Layout>
  );
}