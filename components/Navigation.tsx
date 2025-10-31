import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home, MessageSquare, Settings, Server, FileText, Workflow } from 'lucide-react';

export default function Navigation() {
  const router = useRouter();

  const links = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/chat', label: 'Chat', icon: MessageSquare },
    { href: '/config', label: 'Agent', icon: Settings },
    { href: '/mcp-tools', label: 'MCP Tools', icon: Server },
    { href: '/logs', label: 'Logs', icon: FileText },
    { href: '/workflows', label: 'Workflows', icon: Workflow },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex items-center px-2 text-gray-900 font-semibold text-lg">
              PowerNode
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-2">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = router.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-1.5" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="sm:hidden">
        <div className="px-2 pt-2 pb-3 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = router.pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center px-3 py-2 text-base font-medium rounded-md ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
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
