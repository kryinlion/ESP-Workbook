import { useState } from 'preact/hooks';

/** Copies a list of email addresses so they can be pasted into Mail's To line (the share sheet can't pre-fill it). */
export function CopyEmails({ emails, label = 'Copy emails' }: { emails: string[]; label?: string }) {
  const [done, setDone] = useState('');
  if (!emails.length) return <p class="hint">Tip: add email addresses on the Contacts page and they can be copied here in one tap.</p>;
  const copy = async () => {
    try { await navigator.clipboard.writeText(emails.join(', ')); setDone(`✓ Copied ${emails.length} email${emails.length === 1 ? '' : 's'} — paste into the To line`); }
    catch { setDone(emails.join(', ')); }
  };
  return (
    <div class="copy-emails">
      <button type="button" class="lnk-btn" onClick={copy}>📋 {label} ({emails.length})</button>
      {done && <p class="hint">{done}</p>}
    </div>
  );
}

/** mailto: link with To, subject, and body filled in (text only — mail links can't carry attachments). */
export function mailto(to: string[], subject: string, body: string) {
  return `mailto:${to.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
