import type { ReactNode } from 'react';
import { Binary, Braces, Clock3, FileKey2, Fingerprint, Hash, Link2, LockKeyhole, QrCode, ScanSearch, Wrench } from 'lucide-react';

// Icons for the tool catalogue, shared by the Toolbox sidebar and view.
const icons: Record<string, ReactNode> = {
  Base64: <Binary size={14}/>,
  URL: <Link2 size={14}/>,
  'JSON format': <Braces size={14}/>,
  Timestamp: <Clock3 size={14}/>,
  UUID: <Fingerprint size={14}/>,
  JWT: <FileKey2 size={14}/>,
  'Hash / HMAC': <Hash size={14}/>,
  AES: <LockKeyhole size={14}/>,
  Regex: <ScanSearch size={14}/>,
  'QR code': <QrCode size={14}/>,
};

export function toolIcon(id: string): ReactNode {
  return icons[id] ?? <Wrench size={14}/>;
}
