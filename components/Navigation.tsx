import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home, MessageSquare, Settings, Server, FileText, Workflow, HardDrive, Clock, Layers, FolderGit2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Navigation() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState('');
  const [timezone, setTimezone] = useState('');
  const [modelName, setModelName] = useState('No model loaded');

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

    // Fetch config and determine which model is loaded
    fetch('/api/config').then(res => res.json()).then(data => {
      if (data.defaultProvider && data.providers) {
        const provider = data.providers[data.defaultProvider];
        if (provider && provider.enabled && provider.model) {
          setModelName(provider.model);
        }
      }
    }).catch(() => {});

    return () => clearInterval(interval);
  }, []);

  const links = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/chat', label: 'Chat', icon: MessageSquare },
    { href: '/config', label: 'Agent', icon: Settings },
    { href: '/mcp-tools', label: 'MCP Tools', icon: Server },
    { href: '/storage', label: 'Storage', icon: HardDrive },
    { href: '/logs', label: 'Logs', icon: FileText },
    { href: '/workflows', label: 'Workflows', icon: Workflow },
    { href: '/instances', label: 'Instances', icon: FolderGit2 },
    { href: '/instance-settings', label: 'Settings', icon: Layers },
  ];

  return (
    <nav className="bg-white border-b border-grey-500 shadow-elevation transition-brand">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center px-2 text-primary font-semibold text-lg hover:text-accent transition-brand">
              PowerNode
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-1">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = router.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex items-center px-3 py-2 caption2 transition-brand border-b-2 ${
                      isActive
                        ? 'border-accent text-accent'
                        : 'border-transparent text-neutral-600 hover:text-primary hover:border-primary'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-1.5" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center caption1 text-neutral-600">
            <Clock className="w-4 h-4 mr-2" />
            <span className="font-mono">{currentTime}</span>
            <span className="mx-2 text-grey-700">|</span>
            <span className="caption4">{timezone}</span>
            <span className="mx-2 text-grey-700">|</span>
            <span className="caption3 text-primary">{modelName}</span>
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
                className={`flex items-center px-3 py-2 body2 rounded-lg transition-brand ${
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-neutral-600 hover:bg-bubbles hover:text-primary'
                }`}
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