'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, getProducts } from '@/lib/api-client';
import type { PaginatedResponse, Product } from '@/types/crm';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        isActive
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function ProductsPage() {
  const { token } = useAuth();

  const [productsResponse, setProductsResponse] =
    useState<PaginatedResponse<Product> | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<'all' | 'true' | 'false'>(
    'all',
  );
  const [page, setPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getProducts(token, {
          page,
          pageSize: 10,
          search: submittedSearch || undefined,
          isActive:
            isActiveFilter === 'all' ? undefined : isActiveFilter === 'true',
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        if (!isMounted) {
          return;
        }

        setProductsResponse(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiClientError) {
          setErrorMessage(error.message);
        } else if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Could not load products.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [token, page, submittedSearch, isActiveFilter]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSubmittedSearch(searchInput.trim());
  }

  function handleClearFilters() {
    setSearchInput('');
    setSubmittedSearch('');
    setIsActiveFilter('all');
    setPage(1);
  }

  const products = productsResponse?.data ?? [];
  const meta = productsResponse?.meta;

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            CRM Management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Products
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Manage products and services that can be used in commercial
            opportunities.
          </p>
        </div>

        <Link
          href="/dashboard/products/new"
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          New product
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={handleSearchSubmit}
          className="grid gap-3 lg:grid-cols-[1fr_180px_auto]"
        >
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name, description, category..."
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />

          <select
            value={isActiveFilter}
            onChange={(event) => {
              setPage(1);
              setIsActiveFilter(event.target.value as 'all' | 'true' | 'false');
            }}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="all">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-800"
            >
              Search
            </button>

            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </form>
      </section>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-14 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        </div>
      ) : null}

      {!isLoading && errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && products.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            No products found
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Create your first product or service.
          </p>
        </div>
      ) : null}

      {!isLoading && !errorMessage && products.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Product
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Category
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Created
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {products.map((product) => (
                  <tr key={product.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-950">
                        {product.name}
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                        {product.description ?? 'No description'}
                      </p>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {product.category ?? 'Not specified'}
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge isActive={product.isActive} />
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(product.createdAt)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/products/${product.id}`}
                        className="text-sm font-medium text-blue-700 transition hover:text-blue-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta ? (
            <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-600">
                Page {meta.page} of {meta.totalPages || 1} · {meta.total}{' '}
                products
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!meta.hasPreviousPage}
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>

                <button
                  type="button"
                  disabled={!meta.hasNextPage}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}