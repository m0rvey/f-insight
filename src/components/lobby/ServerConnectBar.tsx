import React, { useState } from 'react';
import { Copy, Check, Play } from 'lucide-react';

interface ServerConnectBarProps {
  serverIp: string;
}

export const ServerConnectBar: React.FC<ServerConnectBarProps> = ({ serverIp }) => {
  const [copiedIp, setCopiedIp] = useState(false);

  const handleCopyIp = () => {
    navigator.clipboard.writeText(`connect ${serverIp}`);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  return (
    <div className="mt-3.5 p-3 rounded-xl bg-gradient-to-r from-zinc-900 via-black to-zinc-900 border border-faceit-orange/40 flex items-center justify-between flex-wrap gap-2 shadow-inner">
      <div className="flex items-center gap-2.5">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-glow-orange" />
        <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Server Ready:</span>
        <code className="text-xs font-mono px-2.5 py-1 rounded bg-black/80 border border-zinc-700/80 text-faceit-orange font-bold">
          connect {serverIp}
        </code>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleCopyIp}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-faceit-orange hover:bg-faceit-orange-hover text-black font-extrabold text-xs transition shadow-glow-orange active:scale-95"
        >
          {copiedIp ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedIp ? 'Copied to Clipboard!' : 'Copy Connect'}</span>
        </button>

        <a
          href={`steam://connect/${serverIp}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-200 text-xs font-bold transition active:scale-95"
        >
          <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
          <span>Launch CS2</span>
        </a>
      </div>
    </div>
  );
};
