'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Account, AccountFilters, AccountStatus } from '@/types';

// 禁用静态生成
export const dynamic = 'force-dynamic';

export default function AccountsPage() {
  // State管理
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [totalCount, setTotalCount] = useState(0);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  
  // 筛选和搜索状态
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deletedFilter, setDeletedFilter] = useState<string>('active');
  const [sortBy, setSortBy] = useState('totalPlays');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 选择状态
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // 批量操作状态
  const [batchLoading, setBatchLoading] = useState(false);
  const [showBatchActions, setShowBatchActions] = useState(false);
  
  // 删除操作状态
  const [deleteLoading, setDeleteLoading] = useState<string>('');

  // 手机编号更新状态
  const [phoneNumberUpdating, setPhoneNumberUpdating] = useState<string>('');

  // 获取账号列表
  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sortBy,
        sortOrder
      });

      if (searchTerm) {
        params.set('search', searchTerm);
      }

      if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      if (deletedFilter) {
        params.set('deleted', deletedFilter);
      }

      const response = await fetch(`/api/accounts?${params}`);
      const data = await response.json();

      if (data.success) {
        setAccounts(data.data.data);
        setTotalCount(data.data.total);
        setTotalPages(data.data.pagination.totalPages);
      } else {
        throw new Error(data.message || '获取账号列表失败');
      }
    } catch (error) {
      console.error('获取账号列表失败:', error);
      setError(error instanceof Error ? error.message : '获取账号列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, statusFilter, deletedFilter, sortBy, sortOrder]);

  // 初始化和依赖更新时获取数据
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // 更新单个账号状态
  const updateAccountStatus = async (author: string, status: AccountStatus | null) => {
    try {
      const response = await fetch(`/api/accounts/${encodeURIComponent(author)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (data.success) {
        // 更新本地状态
        setAccounts(prev => prev.map(account => 
          account.author === author 
            ? { ...account, status }
            : account
        ));
      } else {
        throw new Error(data.message || '更新失败');
      }
    } catch (error) {
      console.error('更新账号状态失败:', error);
      alert(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 批量更新账号状态
  const batchUpdateStatus = async (status: AccountStatus | null) => {
    if (selectedAccounts.length === 0) return;

    try {
      setBatchLoading(true);

      const response = await fetch('/api/accounts/batch', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accounts: selectedAccounts,
          status,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 刷新列表
        await fetchAccounts();
        setSelectedAccounts([]);
        setSelectAll(false);
        setShowBatchActions(false);
      } else {
        throw new Error(data.message || '批量更新失败');
      }
    } catch (error) {
      console.error('批量更新失败:', error);
      alert(`批量更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setBatchLoading(false);
    }
  };

  // 更新手机编号
  const updatePhoneNumber = async (author: string, phoneNumber: string) => {
    try {
      setPhoneNumberUpdating(author);

      const response = await fetch(`/api/accounts/${encodeURIComponent(author)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: phoneNumber || null }),
      });

      const data = await response.json();

      if (data.success) {
        // 更新本地状态
        setAccounts(prev => prev.map(account =>
          account.author === author
            ? { ...account, phoneNumber: phoneNumber || null }
            : account
        ));
      } else {
        throw new Error(data.message || '更新失败');
      }
    } catch (error) {
      console.error('更新手机编号失败:', error);
      alert(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setPhoneNumberUpdating('');
    }
  };

  // 删除单个账号
  const deleteAccount = async (author: string, worksCount: number) => {
    if (!confirm(`确定要删除账号 ${author} 吗？\n将删除该账号的 ${worksCount} 条作品数据`)) {
      return;
    }

    try {
      setDeleteLoading(author);

      const response = await fetch(`/api/accounts/${encodeURIComponent(author)}/delete`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        // 刷新列表
        await fetchAccounts();
        alert(`账号 ${author} 删除成功，共删除 ${data.data.deletedWorksCount} 条作品数据`);
      } else {
        throw new Error(data.message || '删除失败');
      }
    } catch (error) {
      console.error('删除账号失败:', error);
      alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setDeleteLoading('');
    }
  };

  // 处理选择操作
  const handleSelectAccount = (author: string) => {
    setSelectedAccounts(prev => 
      prev.includes(author)
        ? prev.filter(a => a !== author)
        : [...prev, author]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(accounts.map(account => account.author));
    }
    setSelectAll(!selectAll);
  };

  // 格式化数字显示
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // 格式化日期显示
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('zh-CN');
  };

  // 获取状态显示
  const getStatusDisplay = (status: AccountStatus | null, isDeleted?: boolean) => {
    if (isDeleted) return { text: '已删除', color: 'bg-red-100 text-red-800' };
    if (!status) return { text: '未分类', color: 'bg-gray-100 text-gray-800' };
    if (status === '成品号') return { text: '成品号', color: 'bg-green-100 text-green-800' };
    if (status === '半成品号') return { text: '半成品号', color: 'bg-yellow-100 text-yellow-800' };
    return { text: status, color: 'bg-gray-100 text-gray-800' };
  };

  // 分页组件
  const renderPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`px-3 py-2 text-sm font-medium rounded-md ${
            i === currentPage
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="flex items-center justify-between bg-white px-4 py-3 sm:px-6 border-t border-gray-200">
        <div className="flex justify-between sm:hidden">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            上一页
          </button>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            下一页
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              显示第 <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> 到{' '}
              <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalCount)}</span> 条，
              共 <span className="font-medium">{totalCount}</span> 条记录
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                上一页
              </button>
              {pages}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                下一页
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                账号管理
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                管理和分类TikTok账号，查看详细统计信息
              </p>
            </div>
            <div className="mt-4 md:mt-0 md:ml-4 flex space-x-3">
              <button
                onClick={() => window.location.href = '/api/stats/export?type=accounts&format=excel'}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                导出Excel
              </button>
              <button
                onClick={() => window.location.href = '/api/stats/export?type=accounts&format=csv'}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                导出CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 筛选和搜索区域 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* 搜索框 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">搜索账号</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="输入账号名称..."
                className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 状态筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">账号状态</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">全部状态</option>
                <option value="成品号">成品号</option>
                <option value="半成品号">半成品号</option>
                <option value="unclassified">未分类</option>
              </select>
            </div>

            {/* 删除状态筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">显示状态</label>
              <select
                value={deletedFilter}
                onChange={(e) => setDeletedFilter(e.target.value)}
                className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active">仅活跃账号</option>
                <option value="deleted">仅已删除</option>
                <option value="all">全部账号</option>
              </select>
            </div>

            {/* 排序方式 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">排序方式</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="totalPlays">按播放量</option>
                <option value="totalLikes">按点赞数</option>
                <option value="worksCount">按作品数</option>
                <option value="lastUpload">按最后更新</option>
                <option value="author">按账号名称</option>
              </select>
            </div>

            {/* 排序顺序 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">排序顺序</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="desc">降序</option>
                <option value="asc">升序</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={fetchAccounts}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '搜索中...' : '搜索'}
            </button>

            <div className="text-sm text-gray-500">
              共找到 {totalCount} 个账号
            </div>
          </div>
        </div>

        {/* 批量操作区域 */}
        {selectedAccounts.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-blue-800">
                已选择 {selectedAccounts.length} 个账号
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => batchUpdateStatus('成品号')}
                  disabled={batchLoading}
                  className="inline-flex items-center px-3 py-1 border border-transparent rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  设为成品号
                </button>
                <button
                  onClick={() => batchUpdateStatus('半成品号')}
                  disabled={batchLoading}
                  className="inline-flex items-center px-3 py-1 border border-transparent rounded text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
                >
                  设为半成品号
                </button>
                <button
                  onClick={() => batchUpdateStatus(null)}
                  disabled={batchLoading}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  清除分类
                </button>
                <button
                  onClick={() => {
                    setSelectedAccounts([]);
                    setSelectAll(false);
                  }}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  取消选择
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 账号列表表格 */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-500">加载中...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-600">{error}</p>
              <button
                onClick={fetchAccounts}
                className="mt-2 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                重试
              </button>
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              未找到符合条件的账号
            </div>
          ) : (
            <>
              {/* 表格头部 */}
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-900">全选</span>
                </div>
              </div>

              {/* 表格内容 */}
              <ul className="divide-y divide-gray-200">
                {accounts.map((account, index) => {
                  const statusDisplay = getStatusDisplay(account.status, account.isDeleted);
                  
                  return (
                    <li key={account.author} className={`hover:bg-gray-50 ${account.isDeleted ? 'opacity-75' : ''}`}>
                      <div className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          {/* 左侧信息 */}
                          <div className="flex items-center min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={selectedAccounts.includes(account.author)}
                              onChange={() => handleSelectAccount(account.author)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-4"
                            />
                            
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-3">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {account.author}
                                </div>
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusDisplay.color}`}>
                                  {statusDisplay.text}
                                </span>
                                {account.isActive && (
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                    活跃
                                  </span>
                                )}
                              </div>
                              
                              <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                                <span>作品: {account.worksCount}</span>
                                <span>播放: {formatNumber(account.totalPlays)}</span>
                                <span>点赞: {formatNumber(account.totalLikes)}</span>
                                <span>最后更新: {formatDate(account.lastUpload)}</span>
                              </div>
                            </div>
                          </div>

                          {/* 右侧操作 */}
                          <div className="flex items-center space-x-2">
                            {!account.isDeleted ? (
                              <>
                                {/* 手机编号输入框 */}
                                <div className="flex flex-col">
                                  <label className="text-xs text-gray-500 mb-1">手机</label>
                                  <input
                                    type="text"
                                    defaultValue={account.phoneNumber || ''}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      // 只允许输入数字
                                      if (value !== '' && !/^\d+$/.test(value)) {
                                        e.target.value = value.replace(/\D/g, '');
                                      }
                                    }}
                                    onBlur={(e) => {
                                      // 失焦时保存
                                      const newValue = e.target.value;
                                      const originalValue = account.phoneNumber || '';
                                      if (newValue !== originalValue) {
                                        updatePhoneNumber(account.author, newValue);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      // 按回车保存
                                      if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                      }
                                    }}
                                    placeholder="1-99"
                                    disabled={phoneNumberUpdating === account.author}
                                    className="w-16 text-sm text-center border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                  />
                                </div>

                                {/* 账号状态选择器 */}
                                <div className="flex flex-col">
                                  <label className="text-xs text-gray-500 mb-1">状态</label>
                                  <select
                                    value={account.status || ''}
                                    onChange={(e) => updateAccountStatus(account.author, e.target.value as AccountStatus || null)}
                                    className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                  >
                                    <option value="">未分类</option>
                                    <option value="成品号">成品号</option>
                                    <option value="半成品号">半成品号</option>
                                  </select>
                                </div>

                                {/* 删除按钮 */}
                                <button
                                  onClick={() => deleteAccount(account.author, account.worksCount)}
                                  disabled={deleteLoading === account.author}
                                  className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed mt-5"
                                  title={`删除账号（${account.worksCount} 条作品）`}
                                >
                                  {deleteLoading === account.author ? '删除中...' : '删除'}
                                </button>
                              </>
                            ) : (
                              <span className="text-sm text-gray-500">已删除</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* 分页 */}
              {renderPagination()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}