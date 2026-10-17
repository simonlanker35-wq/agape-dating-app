import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, MessageCircle, Plus, Trash2, Flag, RefreshCw, Send, X, UserPlus, Check } from "lucide-react";
import { useApp } from "../context/AppContext";
import * as api from "../services/api";
import { track } from "../services/posthog";
import VerifiedBadge from "../components/VerifiedBadge";
import ProfileSheet from "../components/ProfileSheet";
import ReportSheet from "../components/ReportSheet";

function Toast({ text }) {
  return (
    <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(max(20px, env(safe-area-inset-bottom, 20px)) + 86px)", zIndex: 900, background: "#1A1612", color: "#F5F0E8", padding: "10px 16px", borderRadius: 12, fontSize: 13.5, fontFamily: "'Outfit', system-ui, sans-serif", maxWidth: 320, textAlign: "center", pointerEvents: "none" }}>{text}</div>
  );
}

// Tapping a name or photo opens the person's profile with a wave button; report and block live there too
function MemberProfile({ profile, onClose }) {
  const { state, actions } = useApp();
  const [report, setReport] = useState(false);
  const [waved, setWaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const myId = state.currentUser?.id;
  if (!profile || profile.id === myId) return null;
  const alreadyFriends = (state.matches || []).some((m) => m.profileId === profile.id);
  const wave = async () => {
    if (busy || waved) return;
    setBusy(true);
    try {
      const res = await actions.likeProfile(profile.id, "profile", 0, null, false);
      setWaved(true);
      setNote(res?.matched ? "You are friends now. Find them under Friends." : "Wave sent");
    } catch (e) {
      const dup = /Already liked/.test(e.message || "");
      setNote(dup ? "You already waved at them" : e.message);
      if (dup) setWaved(true);
    }
    setBusy(false);
  };
  const block = async () => {
    try { await actions.blockProfile(profile); onClose(); } catch (e) { setNote(e.message); }
  };
  return (
    <>
      <ProfileSheet
        profile={profile}
        onClose={onClose}
        onReport={() => setReport(true)}
        onBlock={block}
        actions={[
          alreadyFriends
            ? { label: "Already friends", primary: true, disabled: true, icon: <Check size={16} /> }
            : { label: waved ? "Waved" : "Wave", primary: true, disabled: busy || waved, icon: waved ? <Check size={16} /> : <UserPlus size={16} />, onClick: wave },
        ]}
      />
      {note && <Toast text={note} />}
      {report && (
        <ReportSheet
          profileName={profile.name}
          onReport={(reason) => actions.reportProfile(profile, reason, "community").catch(() => {})}
          onBlock={block}
          onClose={() => setReport(false)}
        />
      )}
    </>
  );
}

const C = { bg: "#FFFFFF", card: "#FAFAF8", surface: "#F4F2EE", primary: "#B8912A", primarySoft: "#FBF5E6", text: "#1A1612", sub: "#8C857C", border: "#E8E4DF", sent: "#111111" };
const FONT = "'Outfit', system-ui, sans-serif";
const SERIF = "'Lora', Georgia, serif";

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "prayer", label: "Prayer requests" },
  { id: "faith", label: "Bible & faith" },
  { id: "meetups", label: "Meetups" },
  { id: "life", label: "Life & advice" },
  { id: "church", label: "Church" },
  { id: "general", label: "General" },
];
const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || "General";

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 7 * 86400000) return `${Math.floor(diff / 86400000)}d`;
  return new Date(ts).toLocaleDateString("en", { day: "numeric", month: "short" });
}

function Avatar({ profile, size = 36, onClick }) {
  const name = profile?.name || "?";
  const src = profile?.photos?.[0] || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=96&background=F4F2EE&color=B8912A`;
  return (
    <img src={src} alt={name} onClick={onClick} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", objectPosition: "50% 20%", flexShrink: 0, cursor: onClick ? "pointer" : "default", background: C.surface }}
      onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=96&background=F4F2EE&color=B8912A`; }} />
  );
}

function Byline({ profile, when, mine }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, fontSize: 12.5, color: C.sub, fontFamily: FONT }}>
      <span style={{ fontWeight: 700, color: C.text, fontFamily: SERIF, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mine ? "You" : profile?.name || "Member"}</span>
      {profile?.isVerified && <VerifiedBadge size={13} />}
      {profile?.denomination && <span style={{ whiteSpace: "nowrap" }}>· {profile.denomination}</span>}
      {profile?.location && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>· {profile.location}</span>}
      <span style={{ whiteSpace: "nowrap" }}>· {timeAgo(when)}</span>
    </div>
  );
}

const pill = (on) => ({ padding: "7px 13px", borderRadius: 9999, fontSize: 12.5, fontWeight: 700, fontFamily: FONT, whiteSpace: "nowrap", cursor: "pointer", border: `1px solid ${on ? C.primary : C.border}`, background: on ? C.primary : C.bg, color: on ? "#fff" : C.text, flexShrink: 0 });
const primaryBtn = { padding: "12px 18px", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: FONT, background: C.primary, color: "#fff", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 };

// ── One post with its replies ──
function PostView({ postId, initial, onBack, onChanged }) {
  const { state, actions } = useApp();
  const myId = state.currentUser?.id;
  const [post, setPost] = useState(initial || null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [viewProfile, setViewProfile] = useState(null);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getCommunityPost(postId);
      if (data) { setPost(data.post); setReplies(data.replies); }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [postId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => api.subscribeLive(`post-${postId}`, [{ table: "community_replies", filter: `post_id=eq.${postId}` }], () => load()), [postId, load]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      await api.replyToCommunityPost(postId, body);
      track("community_reply_sent");
      setText("");
      await load();
      onChanged?.();
      setTimeout(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, 50);
    } catch (e) { setError(e.message); }
    setSending(false);
  };

  const toggleAmen = async () => {
    if (!post) return;
    const was = post.amened;
    setPost({ ...post, amened: !was, amenCount: post.amenCount + (was ? -1 : 1) });
    try { await api.amenCommunityPost(post.id, !was); onChanged?.(); } catch (_) { load(); }
  };

  const removePost = async () => {
    try { await api.deleteCommunityPost(postId); track("community_post_deleted"); onChanged?.(); onBack(); } catch (e) { setError(e.message); }
  };
  const removeReply = async (id) => {
    try { await api.deleteCommunityReply(id); await load(); onChanged?.(); } catch (e) { setError(e.message); }
  };
  const report = async (reason) => {
    if (!post) return;
    try { await actions.reportProfile(post.author, reason || "Inappropriate community post", "community", `post:${post.id} · ${post.title}`); setReported(true); } catch (e) { setError(e.message); }
  };
  const blockAuthor = async () => {
    if (!post) return;
    try { await actions.blockProfile(post.author); onChanged?.(); onBack(); } catch (e) { setError(e.message); }
  };
  const openProfile = (p) => { if (p && p.id !== myId) { track("community_profile_opened"); setViewProfile(p); } };

  return (
    <div className="thread-panel" style={{ background: C.bg }}>
      <div style={{ flexShrink: 0, padding: "max(44px, env(safe-area-inset-top, 44px)) 12px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onBack} aria-label="Back" style={{ width: 36, height: 36, borderRadius: 18, background: "none", border: "none", cursor: "pointer", color: C.text, display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={22} strokeWidth={1.8} /></button>
        <p style={{ flex: 1, margin: 0, fontSize: 15, fontWeight: 700, color: C.text, fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post ? catLabel(post.category) : "Post"}</p>
        {post && post.author?.id !== myId && (
          <button onClick={() => (reported ? null : setReportOpen(true))} aria-label={reported ? "Reported" : "Report post"} style={{ height: 36, padding: "0 10px", borderRadius: 18, background: reported ? C.primarySoft : "none", border: "none", cursor: reported ? "default" : "pointer", color: reported ? C.primary : C.sub, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, fontWeight: 700, fontFamily: FONT }}><Flag size={18} strokeWidth={1.8} />{reported ? "Reported" : ""}</button>
        )}
        {post && post.author?.id === myId && (
          <button onClick={() => setConfirmDelete(true)} aria-label="Delete post" style={{ width: 36, height: 36, borderRadius: 18, background: "none", border: "none", cursor: "pointer", color: C.sub, display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={18} strokeWidth={1.8} /></button>
        )}
      </div>

      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 16px 20px" }}>
        {post && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: post.author?.id !== myId ? "pointer" : "default" }} onClick={() => openProfile(post.author)}>
              <Avatar profile={post.author} size={40} />
              <Byline profile={post.author} when={post.createdAt} mine={post.author?.id === myId} />
            </div>
            <h2 style={{ fontSize: 21, fontWeight: 700, color: C.text, fontFamily: SERIF, margin: "0 0 8px", lineHeight: 1.25 }}>{post.title}</h2>
            <p style={{ fontSize: 15, color: C.text, fontFamily: FONT, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{post.body}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={toggleAmen} aria-pressed={post.amened} style={{ ...pill(post.amened), display: "inline-flex", alignItems: "center", gap: 6 }}>🙏 Amen{post.amenCount > 0 ? ` · ${post.amenCount}` : ""}</button>
              <span style={{ ...pill(false), cursor: "default", display: "inline-flex", alignItems: "center", gap: 6 }}><MessageCircle size={13} /> {post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}</span>
            </div>
          </div>
        )}
        {loading && !post && <p style={{ color: C.sub, fontFamily: FONT, textAlign: "center" }}>Loading…</p>}
        {replies.map((r) => (
          <div key={r.id} style={{ display: "flex", gap: 10, padding: "12px 0", borderTop: `1px solid ${C.border}` }}>
            <Avatar profile={r.author} size={32} onClick={r.author?.id !== myId ? () => openProfile(r.author) : undefined} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div onClick={() => openProfile(r.author)} style={{ cursor: r.author?.id !== myId ? "pointer" : "default" }}><Byline profile={r.author} when={r.createdAt} mine={r.author?.id === myId} /></div>
              <p style={{ fontSize: 14.5, color: C.text, fontFamily: FONT, lineHeight: 1.55, margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{r.body}</p>
            </div>
            {r.author?.id === myId && (
              <button onClick={() => removeReply(r.id)} aria-label="Delete reply" style={{ alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer", color: C.sub, padding: 4 }}><Trash2 size={15} strokeWidth={1.8} /></button>
            )}
          </div>
        ))}
        {!loading && post && replies.length === 0 && <p style={{ color: C.sub, fontFamily: FONT, fontSize: 13.5, textAlign: "center", padding: "18px 0 0" }}>No replies yet. Be the first to answer.</p>}
        {error && <p style={{ color: "#EF4444", fontFamily: FONT, fontSize: 13, textAlign: "center", marginTop: 10 }}>{error}</p>}
      </div>

      <div style={{ flexShrink: 0, display: "flex", gap: 8, alignItems: "flex-end", padding: "10px 12px max(12px, env(safe-area-inset-bottom, 12px))", borderTop: `1px solid ${C.border}`, background: C.bg }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply…" rows={1} maxLength={2000}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ flex: 1, resize: "none", minHeight: 42, maxHeight: 120, padding: "11px 14px", borderRadius: 14, border: `1px solid ${C.border}`, background: C.surface, fontSize: 15, fontFamily: FONT, color: C.text, outline: "none", lineHeight: 1.35 }} />
        <button onClick={send} disabled={!text.trim() || sending} aria-label="Send reply" style={{ width: 42, height: 42, borderRadius: 21, border: "none", background: text.trim() ? C.primary : C.border, color: "#fff", cursor: text.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Send size={18} strokeWidth={2} /></button>
      </div>

      {viewProfile && <MemberProfile profile={viewProfile} onClose={() => setViewProfile(null)} />}
      {reportOpen && post && (
        <ReportSheet
          profileName={post.author?.name || "this member"}
          onReport={(reason) => report(reason)}
          onBlock={blockAuthor}
          onClose={() => setReportOpen(false)}
        />
      )}
      {confirmDelete && (
        <div onClick={() => setConfirmDelete(false)} style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: 22, width: "100%", maxWidth: 340 }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: C.text, fontFamily: FONT, margin: "0 0 6px" }}>Delete this post?</p>
            <p style={{ fontSize: 13.5, color: C.sub, fontFamily: FONT, margin: "0 0 16px" }}>The replies go with it. This cannot be undone.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontWeight: 600, fontFamily: FONT, cursor: "pointer" }}>Keep</button>
              <button onClick={removePost} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: "#B91C1C", color: "#fff", fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── New post sheet ──
function NewPostSheet({ onClose, onCreated, initialCategory }) {
  const [category, setCategory] = useState(initialCategory && initialCategory !== "all" ? initialCategory : "general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const ok = title.trim().length >= 3 && body.trim().length >= 1;

  const submit = async () => {
    if (!ok || sending) return;
    setSending(true);
    setError("");
    try {
      const post = await api.createCommunityPost({ category, title: title.trim(), body: body.trim() });
      track("community_post_created", { category });
      onCreated(post);
    } catch (e) { setError(e.message); setSending(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 650, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: C.bg, borderRadius: "24px 24px 0 0", padding: "14px 16px max(20px, env(safe-area-inset-bottom, 20px))", maxHeight: "92dvh", display: "flex", flexDirection: "column" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 12px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: FONT, margin: 0 }}>New post</p>
          <button onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 16, border: "none", background: C.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 10, flexShrink: 0 }}>
          {CATEGORIES.filter((c) => c.id !== "all").map((c) => <button key={c.id} onClick={() => setCategory(c.id)} style={pill(category === c.id)}>{c.label}</button>)}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={120}
          style={{ width: "100%", boxSizing: "border-box", padding: "13px 14px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, fontSize: 16, fontWeight: 600, fontFamily: FONT, color: C.text, outline: "none", marginBottom: 8 }} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={category === "prayer" ? "What can we pray for?" : category === "meetups" ? "What, where and when?" : "Share your thoughts…"} rows={6} maxLength={4000}
          style={{ width: "100%", boxSizing: "border-box", resize: "none", padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, fontSize: 15, fontFamily: FONT, color: C.text, outline: "none", lineHeight: 1.5, flex: 1, minHeight: 120 }} />
        {error && <p style={{ color: "#EF4444", fontFamily: FONT, fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
        <p style={{ fontSize: 12, color: C.sub, fontFamily: FONT, margin: "8px 0 10px", lineHeight: 1.45 }}>Your name, denomination and city show with the post. Keep it kind — posts that break the community guidelines are removed.</p>
        <button onClick={submit} disabled={!ok || sending} style={{ ...primaryBtn, justifyContent: "center", background: ok ? C.primary : C.border, cursor: ok ? "pointer" : "default" }}>{sending ? "Posting…" : "Post"}</button>
      </div>
    </div>
  );
}

// ── The Community tab ──
export default function Community() {
  const { state } = useApp();
  const myId = state.currentUser?.id;
  const [category, setCategory] = useState("all");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null); // post id
  const [compose, setCompose] = useState(false);
  const [listProfile, setListProfile] = useState(null);

  const load = useCallback(async (cat = category) => {
    try {
      const list = await api.getCommunityPosts(cat);
      if (list === null) { setNotReady(true); setPosts([]); } else { setNotReady(false); setPosts(list); }
      setError("");
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [category]);

  useEffect(() => { setLoading(true); load(category); }, [category, load]);
  useEffect(() => api.subscribeLive("community", [{ table: "community_posts" }], () => load()), [load]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const openPost = posts.find((p) => p.id === open);

  if (open) return <PostView postId={open} initial={openPost} onBack={() => setOpen(null)} onChanged={() => load()} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      <div style={{ padding: "max(64px, calc(env(safe-area-inset-top, 0px) + 60px)) 20px 8px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h1 style={{ color: C.text, fontFamily: FONT, fontSize: 24, fontWeight: 700, letterSpacing: "-0.4px", margin: 0 }}>Community</h1>
          <p style={{ color: C.sub, fontSize: 13, marginTop: 4, fontFamily: FONT }}>Prayer, questions, meetups — for everyone here for friendship</p>
        </div>
        <button onClick={() => load()} aria-label="Refresh" style={{ width: 36, height: 36, borderRadius: 18, border: `1px solid ${C.border}`, background: C.bg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.sub, flexShrink: 0 }}><RefreshCw size={16} /></button>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", padding: "6px 20px 10px", flexShrink: 0 }}>
        {CATEGORIES.map((c) => <button key={c.id} onClick={() => setCategory(c.id)} style={pill(category === c.id)}>{c.label}</button>)}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 120px" }}>
        {notReady ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.sub, fontFamily: FONT }}>
            <MessageCircle size={44} strokeWidth={1.4} color={C.primary} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 4px" }}>The community opens soon</p>
            <p style={{ fontSize: 13.5, margin: 0 }}>It is being set up on our side. Check back in a little while.</p>
          </div>
        ) : loading && posts.length === 0 ? (
          <p style={{ color: C.sub, fontFamily: FONT, textAlign: "center", padding: 40 }}>Loading…</p>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.sub, fontFamily: FONT }}>
            <MessageCircle size={44} strokeWidth={1.4} color={C.primary} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 4px" }}>Nothing here yet</p>
            <p style={{ fontSize: 13.5, margin: 0 }}>Start the first conversation — a prayer request, a question, or a meetup.</p>
          </div>
        ) : (
          posts.map((p) => (
            <button key={p.id} onClick={() => { track("community_post_opened"); setOpen(p.id); }} style={{ display: "block", width: "100%", textAlign: "left", background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "14px 14px 12px", marginBottom: 10, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span onClick={(e) => { if (p.author?.id !== myId) { e.stopPropagation(); track("community_profile_opened"); setListProfile(p.author); } }} style={{ display: "contents" }}>
                  <Avatar profile={p.author} size={32} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}><Byline profile={p.author} when={p.lastActivity} mine={p.author?.id === myId} /></div>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, background: C.primarySoft, padding: "4px 9px", borderRadius: 9999, fontFamily: FONT, whiteSpace: "nowrap" }}>{catLabel(p.category)}</span>
              </div>
              <p style={{ fontSize: 17, fontWeight: 700, color: C.text, fontFamily: SERIF, margin: "0 0 4px", lineHeight: 1.3 }}>{p.title}</p>
              <p style={{ fontSize: 14, color: C.sub, fontFamily: FONT, margin: 0, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>{p.body}</p>
              <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12.5, color: p.amened ? C.primary : C.sub, fontFamily: FONT, fontWeight: 600 }}>
                <span>🙏 {p.amenCount}</span>
                <span style={{ color: C.sub, display: "inline-flex", alignItems: "center", gap: 4 }}><MessageCircle size={13} /> {p.replyCount}</span>
              </div>
            </button>
          ))
        )}
        {error && <p style={{ color: "#EF4444", fontFamily: FONT, fontSize: 13, textAlign: "center" }}>{error}</p>}
      </div>

      {!notReady && (
        <button onClick={() => { track("community_compose_opened"); setCompose(true); }} aria-label="New post" style={{ ...primaryBtn, position: "fixed", right: "max(16px, calc(50% - 215px + 16px))", bottom: "calc(max(18px, env(safe-area-inset-bottom, 18px)) + 84px)", zIndex: 120, borderRadius: 9999, padding: "13px 18px", boxShadow: "0 8px 24px rgba(184,145,42,0.4)" }}>
          <Plus size={18} strokeWidth={2.4} /> New post
        </button>
      )}

      {listProfile && <MemberProfile profile={listProfile} onClose={() => setListProfile(null)} />}
      {compose && <NewPostSheet initialCategory={category} onClose={() => setCompose(false)} onCreated={(post) => { setCompose(false); load(); setOpen(post.id); }} />}
    </div>
  );
}
