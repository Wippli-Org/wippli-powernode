import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Home, MessageSquare, Settings, Server, FileText, Workflow, HardDrive, Clock, Layers } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Navigation() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState('');
  const [timezone, setTimezone] = useState('');
  const [modelName, setModelName] = useState('Claude Sonnet 3.5');

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(tz);

    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCurrentTime(timeStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    fetch('/api/config').then(res => res.json()).then(data => { if (data.anthropicModel) { setModelName(data.anthropicModel); } }).catch(() => {});

    return () => clearInterval(interval);
  }, []);

  const links = [
    { href: '/chat', label: 'Chat', icon: MessageSquare },
    { href: '/config', label: 'Agent', icon: Settings },
    { href: '/mcp-tools', label: 'MCP', icon: Server },
    { href: '/storage', label: 'Storage', icon: HardDrive },
    { href: '/workflows', label: 'Workflows', icon: Workflow },
    { href: '/instance-settings', label: 'Instance', icon: Layers },
  ];

  return (
    <nav style={{ backgroundColor: 'var(--branding-purple)' }} className="shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/chat" className="flex items-center space-x-3 px-2">
              <Image
                src="/logos/wippli-logo-dark.svg"
                alt="Wippli"
                width={120}
                height={32}
                priority
                className="h-8 w-auto"
              />
              <span className="text-white font-semibold text-lg border-l pl-3" style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}>
                PowerNode
              </span>
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8 flex-1">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = router.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium transition-all duration-200"
                    style={{
                      color: isActive ? 'white' : 'rgba(255, 255, 255, 0.85)',
                      backgroundColor: isActive ? 'var(--branding-purple-hover)' : 'transparent',
                      borderRadius: 'var(--radius-md)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.color = 'white';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)';
                      }
                    }}
                  >
                    <Icon className="w-4 h-4 mr-1.5" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center text-sm text-white space-x-2">
            <Clock className="w-4 h-4" style={{ opacity: 0.85 }} />
            <span className="font-mono font-medium">{currentTime}</span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span className="text-xs" style={{ opacity: 0.85 }}>{timezone}</span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span className="text-xs font-medium bg-white bg-opacity-20 px-2 py-1 rounded" style={{ opacity: 0.95 }}>{modelName}</span>
          </div>
        </div>
      </div>
      <div className="sm:hidden">
        <div className="px-2 pt-2 pb-3 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = router.pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center px-3 py-2 text-base font-medium rounded-md transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--branding-purple-hover)' : 'transparent',
                  color: 'white',
                }}
              >
                <Icon className="w-5 h-5 mr-2" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}