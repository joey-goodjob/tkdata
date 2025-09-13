"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  ChartBarIcon,
  UserGroupIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";

export function Header() {
  const pathname = usePathname();

  const navigation = [
    {
      name: "数据上传",
      href: "/",
      icon: ArrowUpTrayIcon,
      description: "上传Excel文件",
    },
    {
      name: "数据仪表板",
      href: "/dashboard",
      icon: ChartBarIcon,
      description: "统计分析数据",
    },
    {
      name: "账号管理",
      href: "/accounts",
      icon: UserGroupIcon,
      description: "管理TikTok账号",
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">TK</span>
              </div>
              <span className="text-xl font-bold text-gray-900">
                非幕集团 tiktok 数据管理系统
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    group flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                    ${
                      active
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }
                  `}
                  title={item.description}
                >
                  <Icon
                    className={`
                      w-5 h-5 mr-2 transition-colors
                      ${
                        active
                          ? "text-blue-600"
                          : "text-gray-400 group-hover:text-gray-500"
                      }
                    `}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Mobile menu button (placeholder for future mobile nav) */}
          <div className="md:hidden">
            <button
              type="button"
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              aria-label="打开菜单"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation (简化版) */}
        <div className="md:hidden pb-3 pt-2 border-t border-gray-200 mt-2">
          <div className="grid grid-cols-3 gap-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex flex-col items-center justify-center p-2 rounded-lg text-xs font-medium transition-all
                    ${
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }
                  `}
                >
                  <Icon
                    className={`w-5 h-5 mb-1 ${
                      active ? "text-blue-600" : "text-gray-400"
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
