import { useState, useRef, useCallback } from "react";
import {
  ChevronUp,
  ChevronDown,
  GripVertical,
  Trash2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  User,
  Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const IMG_URL = "https://YOUR_SUPABASE_REF.supabase.co/storage/v1/object/public/course-covers/automation/coach-Coach-profile.png";
const DEFAULT_RAZORPAY = "https://pages.razorpay.com/your-page-id/view";

export interface EmailBlock {
  id: string;
  type: "text" | "image" | "button" | "divider" | "spacer" | "link";
  content?: string;
  url?: string;
  buttonText?: string;
  buttonColor?: string;
  imageUrl?: string;
  linkText?: string;
  linkUrl?: string;
  align?: string;
}

// Header config that sits between the image and body
export interface HeaderConfig {
  headline: string;
  buttonText: string;
  buttonUrl: string;
}

// ─── Personalization Tokens ─────────────────────────────────
const PERSONALIZATION_TOKENS = [
  { label: "First Name", token: "{{first_name}}" },
  { label: "Email", token: "{{email}}" },
  { label: "Phone", token: "{{phone}}" },
  { label: "Tag", token: "{{tag}}" },
];

// ─── Rich Text Colors ───────────────────────────────────────
const TEXT_COLORS = [
  { label: "Black", value: "#000000" },
  { label: "Gray", value: "#666666" },
  { label: "Gold", value: "#FFB433" },
  { label: "Green", value: "#22C55E" },
  { label: "Blue", value: "#3B82F6" },
  { label: "Red", value: "#EF4444" },
  { label: "Purple", value: "#8B5CF6" },
  { label: "White", value: "#FFFFFF" },
];

const FONT_SIZES = ["14px", "16px", "18px", "20px", "24px"];

// ─── Unsubscribe Footer HTML ────────────────────────────────
const UNSUBSCRIBE_FOOTER_HTML = `<div style="text-align:center;padding:20px;font-size:11px;color:#888;font-family:Arial,sans-serif;border-top:1px solid #eee;margin-top:30px">
  <p style="margin:0 0 6px">You're receiving this because you signed up at Your Coach's website.</p>
  <p style="margin:0"><a href="https://your-domain.com/unsubscribe?email={{email}}&token={{unsubscribe_token}}" style="color:#888;text-decoration:underline">Unsubscribe</a></p>
</div>`;

function parseHtmlToBlocks(html: string): EmailBlock[] {
  if (!html) return [{ id: "1", type: "text", content: "Hi {{first_name}},\n\nWrite your email here..." }];
  
  const blocks: EmailBlock[] = [];
  let id = 1;
  
  // Strip header image, headline+button section, and first CTA button (it's in the header)
  let clean = html
    .replace(/<div[^>]*text-align:center[^>]*>[\s\S]*?<img[^>]*coach-Coach[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<div[^>]*class="header-section"[^>]*>[\s\S]*?<\/div>/gi, "");
  
  // Remove the unsubscribe footer we auto-appended
  clean = clean.replace(/<div[^>]*>[\s\S]*?unsubscribe_url[\s\S]*?<\/div>/gi, "");
  
  // Remove the FIRST button/link block (it's always the header CTA, shown in the two-column section)
  let firstBtnRemoved = false;
  clean = clean.replace(/<(?:p|table|div)[^>]*>[\s\S]*?<a[^>]*style="[^"]*(?:background|background-color)[^"]*"[^>]*>[\s\S]*?<\/a>[\s\S]*?<\/(?:p|table|div)>/i, (match) => {
    if (!firstBtnRemoved) { firstBtnRemoved = true; return ""; }
    return match;
  });
  
  const parts = clean.split(/(<p[^>]*>[\s\S]*?<\/p>|<ul[^>]*>[\s\S]*?<\/ul>|<ol[^>]*>[\s\S]*?<\/ol>|<a[^>]*style="[^"]*background[^"]*"[^>]*>[\s\S]*?<\/a>|<div[^>]*>[\s\S]*?<\/div>|<img[^>]*>)/gi);
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === "<br>" || trimmed === "<br/>") continue;
    
    const btnMatch = trimmed.match(/<a[^>]*href="([^"]*)"[^>]*style="[^"]*background[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (btnMatch) {
      const text = btnMatch[2].replace(/<[^>]+>/g, "").trim();
      if (text) {
        blocks.push({ id: String(id++), type: "button", buttonText: text, url: btnMatch[1], buttonColor: "#FFB433" });
        continue;
      }
    }
    
    const imgMatch = trimmed.match(/<img[^>]*src="([^"]*)"[^>]*>/i);
    if (imgMatch && !imgMatch[1].includes("coach-Coach")) {
      blocks.push({ id: String(id++), type: "image", imageUrl: imgMatch[1] });
      continue;
    }
    
    let text = trimmed
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .trim();
    
    if (text && text.length > 1) {
      blocks.push({ id: String(id++), type: "text", content: text });
    }
  }
  
  if (blocks.length === 0) {
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ id: "1", type: "text", content: text });
  }
  
  return blocks;
}

function blocksToHtml(blocks: EmailBlock[]): string {
  const bodyHtml = blocks.map(b => {
    switch (b.type) {
      case "text":
        return (b.content || "").split("\n\n").map(p => 
          `<p style="font-family:'Inter',sans-serif;color:#515856;font-size:16px;line-height:165%;margin:0 0 10px">${p.split("\n").join("<br>")}</p>`
        ).join("");
      case "button":
        return `<table width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:20px 0"><a href="${b.url || "#"}" style="display:inline-block;background:${b.buttonColor || "#FFB433"};color:#ffffff;padding:14px 25px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;font-family:'Inter',sans-serif;letter-spacing:0.025em">${b.buttonText || "Click Here"}</a></td></tr></table>`;
      case "image":
        return `<p style="text-align:center"><img src="${b.imageUrl || ""}" style="max-width:100%;border-radius:8px" /></p>`;
      case "link":
        return `<p style="font-family:'Inter',sans-serif;color:#515856;font-size:16px;line-height:165%;margin:0 0 10px"><a href="${b.linkUrl || "#"}" style="color:#FFB433;font-weight:bold;text-decoration:underline;">${b.linkText || "Click here"}</a></p>`;
      case "divider":
        return `<hr style="border:none;border-top:2px solid #FFB433;margin:16px 0" />`;
      case "spacer":
        return `<div style="height:20px"></div>`;
      default:
        return "";
    }
  }).join("\n");
  
  // Always append mandatory unsubscribe footer
  return bodyHtml + "\n" + UNSUBSCRIBE_FOOTER_HTML;
}

// ─── Rich Text Toolbar Component ────────────────────────────
function RichTextToolbar({
  blockId,
  onFormat,
  onInsertToken,
}: {
  blockId: string;
  onFormat: (blockId: string, tag: string, value?: string) => void;
  onInsertToken: (blockId: string, token: string) => void;
}) {
  const [showColors, setShowColors] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const [showTokens, setShowTokens] = useState(false);

  return (
    <div className="flex items-center gap-1 flex-wrap mb-1.5 p-1.5 bg-white/80 rounded-lg border border-gray-200/60">
      {/* Bold / Italic / Underline */}
      <button
        onClick={() => onFormat(blockId, "bold")}
        className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
        title="Bold"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onFormat(blockId, "italic")}
        className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
        title="Italic"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onFormat(blockId, "underline")}
        className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
        title="Underline"
      >
        <Underline className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-5 bg-gray-200 mx-0.5" />

      {/* Alignment */}
      <button
        onClick={() => onFormat(blockId, "align", "left")}
        className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
        title="Align Left"
      >
        <AlignLeft className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onFormat(blockId, "align", "center")}
        className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
        title="Align Center"
      >
        <AlignCenter className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onFormat(blockId, "align", "right")}
        className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors"
        title="Align Right"
      >
        <AlignRight className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-5 bg-gray-200 mx-0.5" />

      {/* Font Size Dropdown */}
      <div className="relative">
        <button
          onClick={() => { setShowSizes(!showSizes); setShowColors(false); setShowTokens(false); }}
          className="h-7 px-2 rounded flex items-center gap-1 hover:bg-gray-100 text-gray-600 text-[10px] font-medium transition-colors"
          title="Font Size"
        >
          Size
        </button>
        {showSizes && (
          <div className="absolute top-8 left-0 z-30 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[80px]">
            {FONT_SIZES.map(size => (
              <button
                key={size}
                onClick={() => { onFormat(blockId, "fontSize", size); setShowSizes(false); }}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Color Picker */}
      <div className="relative">
        <button
          onClick={() => { setShowColors(!showColors); setShowSizes(false); setShowTokens(false); }}
          className="h-7 px-2 rounded flex items-center gap-1 hover:bg-gray-100 text-gray-600 text-[10px] font-medium transition-colors"
          title="Text Color"
        >
          <span className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500" />
        </button>
        {showColors && (
          <div className="absolute top-8 left-0 z-30 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-4 gap-1.5 min-w-[110px]">
            {TEXT_COLORS.map(color => (
              <button
                key={color.value}
                onClick={() => { onFormat(blockId, "color", color.value); setShowColors(false); }}
                className="w-6 h-6 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                style={{ background: color.value }}
                title={color.label}
              />
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-gray-200 mx-0.5" />

      {/* Personalize Token Insert */}
      <div className="relative">
        <button
          onClick={() => { setShowTokens(!showTokens); setShowColors(false); setShowSizes(false); }}
          className="h-7 px-2 rounded flex items-center gap-1 hover:bg-[#FFB433]/10 text-[#FFB433] text-[10px] font-semibold transition-colors"
          title="Insert Personalization Token"
        >
          <User className="w-3 h-3" /> Personalize
        </button>
        {showTokens && (
          <div className="absolute top-8 right-0 z-30 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
            {PERSONALIZATION_TOKENS.map(t => (
              <button
                key={t.token}
                onClick={() => { onInsertToken(blockId, t.token); setShowTokens(false); }}
                className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-[#FFB433]/5 transition-colors flex items-center justify-between"
              >
                <span>{t.label}</span>
                <span className="text-[10px] font-mono bg-[#FFB433]/10 text-[#FFB433] px-1.5 py-0.5 rounded">
                  {t.token}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Render content with token highlighting for preview ─────
function renderContentPreview(content: string): React.ReactNode {
  if (!content) return "Click to edit...";
  const parts = content.split(/({{[^}]+}})/g);
  return parts.map((part, i) => {
    if (part.match(/^{{[^}]+}}$/)) {
      return (
        <span
          key={i}
          style={{
            background: "rgba(255,180,51,0.15)",
            color: "#FFB433",
            padding: "1px 6px",
            borderRadius: "4px",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

interface Props {
  blocks: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
  subject: string;
  onSubjectChange: (s: string) => void;
  headerConfig?: HeaderConfig;
  onHeaderChange?: (h: HeaderConfig) => void;
  readOnly?: boolean;
}

export function EmailEditor({ blocks, onChange, subject, onSubjectChange, headerConfig, onHeaderChange, readOnly }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const header: HeaderConfig = headerConfig || {
    headline: "Abundance Breakthrough: Journey with Your Coach",
    buttonText: "BOOK YOUR LIFE\nUPGRADE CALL",
    buttonUrl: DEFAULT_RAZORPAY,
  };

  const addBlock = (type: EmailBlock["type"]) => {
    const newBlock: EmailBlock = {
      id: String(Date.now()),
      type,
      content: type === "text" ? "Edit this text..." : undefined,
      buttonText: type === "button" ? "BOOK YOUR CALL" : undefined,
      buttonColor: type === "button" ? "#FFB433" : undefined,
      url: type === "button" ? DEFAULT_RAZORPAY : undefined,
      imageUrl: type === "image" ? "" : undefined,
      linkText: type === "link" ? "Click here" : undefined,
      linkUrl: type === "link" ? DEFAULT_RAZORPAY : undefined,
    };
    onChange([...blocks, newBlock]);
  };

  const updateBlock = (id: string, updates: Partial<EmailBlock>) => {
    onChange(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBlock = (id: string) => onChange(blocks.filter(b => b.id !== id));

  const moveBlock = (id: string, direction: -1 | 1) => {
    const idx = blocks.findIndex(b => b.id === id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const nb = [...blocks];
    [nb[idx], nb[newIdx]] = [nb[newIdx], nb[idx]];
    onChange(nb);
  };

  // ─── Rich Text Formatting (wraps selected text in HTML tags) ─
  const handleFormat = useCallback((blockId: string, tag: string, value?: string) => {
    const textarea = textareaRefs.current[blockId];
    if (!textarea) return;

    const block = blocks.find(b => b.id === blockId);
    if (!block || block.type !== "text") return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const content = block.content || "";
    const selected = content.substring(start, end);

    if (tag === "align") {
      updateBlock(blockId, { align: value });
      return;
    }

    if (!selected) return;

    let wrapped = selected;
    switch (tag) {
      case "bold":
        wrapped = `<b>${selected}</b>`;
        break;
      case "italic":
        wrapped = `<i>${selected}</i>`;
        break;
      case "underline":
        wrapped = `<u>${selected}</u>`;
        break;
      case "fontSize":
        wrapped = `<span style="font-size:${value}">${selected}</span>`;
        break;
      case "color":
        wrapped = `<span style="color:${value}">${selected}</span>`;
        break;
    }

    const newContent = content.substring(0, start) + wrapped + content.substring(end);
    updateBlock(blockId, { content: newContent });

    // Restore focus
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + wrapped.length);
    }, 0);
  }, [blocks, updateBlock]);

  // ─── Insert personalization token at cursor position ──────
  const handleInsertToken = useCallback((blockId: string, token: string) => {
    const textarea = textareaRefs.current[blockId];
    if (!textarea) return;

    const block = blocks.find(b => b.id === blockId);
    if (!block || block.type !== "text") return;

    const start = textarea.selectionStart;
    const content = block.content || "";
    const newContent = content.substring(0, start) + token + content.substring(start);
    updateBlock(blockId, { content: newContent });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  }, [blocks, updateBlock]);

  return (
    <div className="flex-1">
      {/* Subject */}
      <div className="mb-3">
        <label className="text-[10px] font-semibold text-[#888] block mb-1">Subject Line</label>
        <input
          value={subject}
          onChange={e => onSubjectChange(e.target.value)}
          readOnly={readOnly}
          className="w-full h-10 px-4 rounded-xl bg-[#0f1117] border border-white/[0.06] text-white text-sm focus:outline-none focus:border-[#FFB433]/50"
          placeholder="Email subject..."
        />
      </div>

      {/* Template */}
      <div className="bg-[#e8e8e8] rounded-xl p-4 overflow-auto max-h-[70vh]">
        <div className="max-w-[600px] mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
          
          {/* ========== BLACK HEADER — Coach Coach Banner (Large, Centered) ========== */}
          <div style={{ background: "#000", borderRadius: "12px 12px 0 0", padding: "40px 30px", textAlign: "center" }}>
            <img src={IMG_URL} style={{ width: "100%", maxWidth: "480px", borderRadius: "10px", display: "block", margin: "0 auto" }} />
          </div>

          {/* ========== GOLD DIVIDER ========== */}
          <div style={{ background: "#fff", padding: "0 50px" }}>
            <div style={{ borderTop: "3px solid #FFB433", margin: "0" }} />
          </div>

          {/* ========== TWO-COLUMN: Headline + Gold Button ========== */}
          <div 
            style={{ background: "#fff", padding: "30px 50px 20px" }}
            className={`${!readOnly ? "cursor-pointer" : ""} ${editingHeader ? "ring-2 ring-[#FFB433] ring-offset-2 rounded" : ""}`}
            onClick={() => !readOnly && setEditingHeader(true)}
          >
            {editingHeader && !readOnly ? (
              <div className="space-y-3 p-2 border border-[#FFB433]/30 rounded-lg bg-[#FFFDF5]">
                <div>
                  <label className="text-[9px] text-gray-500 font-medium">Headline Text</label>
                  <input
                    value={header.headline}
                    onChange={e => onHeaderChange?.({ ...header, headline: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded text-sm italic text-gray-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-gray-500 font-medium">Button Text</label>
                  <input
                    value={header.buttonText}
                    onChange={e => onHeaderChange?.({ ...header, buttonText: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded text-sm text-center focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-gray-500 font-medium">Button URL (Razorpay link)</label>
                  <input
                    value={header.buttonUrl}
                    onChange={e => onHeaderChange?.({ ...header, buttonUrl: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded text-[10px] text-gray-400 focus:outline-none"
                  />
                </div>
                <button onClick={(e) => { e.stopPropagation(); setEditingHeader(false); }} className="px-3 py-1 rounded bg-[#FFB433] text-white text-[10px] font-semibold">Done</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
                {/* Left: Italic headline */}
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'Inter', sans-serif", color: "#515856", fontSize: "16px", lineHeight: "165%", fontWeight: 700, fontStyle: "italic", margin: 0 }}>
                    {header.headline}
                  </p>
                </div>
                {/* Right: Gold CTA button */}
                <div style={{ flexShrink: 0 }}>
                  <span style={{
                    display: "inline-block",
                    background: "#FFB433",
                    color: "#fff",
                    padding: "14px 25px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: 600,
                    letterSpacing: "0.025em",
                    textAlign: "center",
                    lineHeight: "1.3",
                    whiteSpace: "pre-line",
                  }}>
                    {header.buttonText}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ========== WHITE BODY — Editable Blocks ========== */}
          <div style={{ background: "#fff", padding: "10px 50px 40px", minHeight: "200px" }}>
            {blocks.map((block, blockIdx) => (
              <div
                key={block.id}
                className={`relative group mb-1 ${selectedId === block.id ? "ring-2 ring-[#FFB433] ring-offset-2 rounded-lg" : ""} ${!readOnly ? "cursor-pointer" : ""}`}
                onClick={() => { if (!readOnly) { setSelectedId(block.id); setEditingHeader(false); } }}
              >
                {/* Block Controls — Enhanced with icons */}
                {!readOnly && (
                  <div className="absolute -left-11 top-0 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <div className="flex items-center justify-center w-8 h-5 text-gray-300 cursor-grab">
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                    {blockIdx > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); moveBlock(block.id, -1); }}
                        className="w-8 h-7 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors"
                        title="Move up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {blockIdx < blocks.length - 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 1); }}
                        className="w-8 h-7 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors"
                        title="Move down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                      className="w-8 h-7 rounded bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-colors"
                      title="Delete block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* TEXT */}
                {block.type === "text" && (
                  selectedId === block.id && !readOnly ? (
                    <div>
                      <RichTextToolbar
                        blockId={block.id}
                        onFormat={handleFormat}
                        onInsertToken={handleInsertToken}
                      />
                      <textarea
                        ref={(el) => { textareaRefs.current[block.id] = el; }}
                        value={block.content || ""}
                        onChange={e => updateBlock(block.id, { content: e.target.value })}
                        className="w-full p-2 border border-[#FFB433]/30 rounded-lg text-[15px] text-gray-700 leading-relaxed resize-none focus:outline-none min-h-[60px]"
                        style={{ fontFamily: "'Inter', sans-serif", textAlign: (block.align as any) || "left" }}
                        autoFocus
                        rows={Math.max(3, (block.content || "").split("\n").length)}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        color: "#515856",
                        fontSize: "16px",
                        lineHeight: "165%",
                        whiteSpace: "pre-wrap",
                        padding: "2px 0",
                        textAlign: (block.align as any) || "left",
                      }}
                    >
                      {renderContentPreview(block.content || "")}
                    </div>
                  )
                )}

                {/* BUTTON */}
                {block.type === "button" && (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    {selectedId === block.id && !readOnly ? (
                      <div className="space-y-2">
                        <input value={block.buttonText || ""} onChange={e => updateBlock(block.id, { buttonText: e.target.value })} className="w-full p-2 border border-[#FFB433]/30 rounded-lg text-sm text-center focus:outline-none" placeholder="Button text" />
                        <input value={block.url || ""} onChange={e => updateBlock(block.id, { url: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg text-xs text-gray-500 focus:outline-none" placeholder="Button URL" />
                        <div className="flex gap-2 justify-center">
                          {["#FFB433", "#22C55E", "#3B82F6", "#F43648", "#8B5CF6", "#000"].map(c => (
                            <button key={c} onClick={() => updateBlock(block.id, { buttonColor: c })} className={`w-6 h-6 rounded-full ${block.buttonColor === c ? "ring-2 ring-offset-1 ring-gray-400" : ""}`} style={{ background: c }} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span style={{
                        display: "inline-block",
                        background: block.buttonColor || "#FFB433",
                        color: "#fff",
                        padding: "14px 25px",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: 600,
                        letterSpacing: "0.025em",
                      }}>
                        {block.buttonText || "Click Here"}
                      </span>
                    )}
                  </div>
                )}

                {/* IMAGE — Enhanced with URL input */}
                {block.type === "image" && (
                  <div style={{ textAlign: "center", padding: "8px 0" }}>
                    {selectedId === block.id && !readOnly ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50">
                          <ImageIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <input
                            value={block.imageUrl || ""}
                            onChange={e => updateBlock(block.id, { imageUrl: e.target.value })}
                            className="flex-1 bg-transparent text-xs text-gray-600 focus:outline-none"
                            placeholder="Paste image URL here..."
                          />
                        </div>
                        {block.imageUrl ? (
                          <img src={block.imageUrl} style={{ maxWidth: "100%", borderRadius: "8px", margin: "0 auto" }} />
                        ) : (
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                            <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-xs text-gray-400">Paste an image URL above to preview</p>
                          </div>
                        )}
                      </div>
                    ) : block.imageUrl ? (
                      <img src={block.imageUrl} style={{ maxWidth: "100%", borderRadius: "8px", margin: "0 auto" }} />
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <ImageIcon className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                        <p className="text-[10px] text-gray-400">Click to add image URL</p>
                      </div>
                    )}
                  </div>
                )}

                {/* LINK */}
                {block.type === "link" && (
                  <div style={{ padding: "4px 0" }}>
                    {selectedId === block.id && !readOnly ? (
                      <div className="space-y-2 p-2 border border-[#FFB433]/30 rounded-lg bg-[#FFFDF5]">
                        <div>
                          <label className="text-[9px] text-gray-500 font-medium">Link Text</label>
                          <input value={block.linkText || ""} onChange={e => updateBlock(block.id, { linkText: e.target.value })} className="w-full p-2 border border-gray-200 rounded text-sm focus:outline-none" placeholder="Display text" />
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-500 font-medium">URL</label>
                          <input value={block.linkUrl || ""} onChange={e => updateBlock(block.id, { linkUrl: e.target.value })} className="w-full p-2 border border-gray-200 rounded text-xs text-gray-500 focus:outline-none" placeholder="https://..." />
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "#FFB433", fontWeight: "bold", textDecoration: "underline", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "16px" }}>
                        {block.linkText || "Click here"}
                      </span>
                    )}
                  </div>
                )}

                {block.type === "divider" && <hr style={{ border: "none", borderTop: "2px solid #FFB433", margin: "16px 0" }} />}
                {block.type === "spacer" && <div style={{ height: "20px" }} />}
              </div>
            ))}

            {/* Add block bar */}
            {!readOnly && (
              <div style={{ borderTop: "1px dashed #ddd", marginTop: "16px", paddingTop: "12px" }}>
                <p style={{ fontSize: "10px", color: "#aaa", textAlign: "center", marginBottom: "8px" }}>Add element</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {[
                    { type: "text" as const, icon: "📝", label: "Text" },
                    { type: "link" as const, icon: "🔗", label: "Link" },
                    { type: "button" as const, icon: "🔘", label: "Button" },
                    { type: "image" as const, icon: "🖼", label: "Image" },
                    { type: "divider" as const, icon: "―", label: "Divider" },
                    { type: "spacer" as const, icon: "↕", label: "Spacer" },
                  ].map(b => (
                    <button key={b.type} onClick={() => addBlock(b.type)} className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-[10px] font-medium hover:bg-gray-100 border border-gray-200">
                      {b.icon} {b.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ========== Unsubscribe Footer (always visible, non-editable) ========== */}
          <div style={{
            background: "#fff",
            borderRadius: "0 0 12px 12px",
            padding: "0 50px 30px",
            opacity: 0.6,
            pointerEvents: "none",
          }}>
            <div style={{ textAlign: "center", padding: "20px", borderTop: "1px solid #eee", marginTop: "0", fontSize: "11px", color: "#888", fontFamily: "Arial, sans-serif" }}>
              <p style={{ margin: "0 0 6px" }}>
                You're receiving this because you signed up at Your Coach's website.
              </p>
              <p style={{ margin: 0 }}>
                <span style={{ color: "#888", textDecoration: "underline" }}>Unsubscribe</span>
              </p>
            </div>
          </div>

          {/* Legacy footer (hidden since we have new unsubscribe) */}
        </div>
      </div>
    </div>
  );
}

export { parseHtmlToBlocks, blocksToHtml };
export type { HeaderConfig };
